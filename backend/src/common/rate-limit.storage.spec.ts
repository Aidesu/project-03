import { Logger } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import {
  RateLimitRedisClient,
  RateLimitStorage,
  redisOptionsForRateLimiting,
} from './rate-limit.storage';

type StorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

const KEY = 'hashed-key';
const TTL = 60_000;
const LIMIT = 5;
const BLOCK = 60_000;
const NAME = 'default';

function record(totalHits: number): StorageRecord {
  return {
    totalHits,
    timeToExpire: 60,
    isBlocked: false,
    timeToBlockExpire: 0,
  };
}

function increment(storage: RateLimitStorage): Promise<StorageRecord> {
  return storage.increment(KEY, TTL, LIMIT, BLOCK, NAME);
}

class FakeClient implements RateLimitRedisClient {
  handlers: ((err: Error) => void)[] = [];
  disconnected: boolean | null = null;

  on(_event: 'error', listener: (err: Error) => void): this {
    this.handlers.push(listener);
    return this;
  }

  emitError(err: Error): void {
    this.handlers.forEach((h) => h(err));
  }

  disconnect(reconnect?: boolean): void {
    this.disconnected = reconnect ?? true;
  }
}

describe('RateLimitStorage', () => {
  let remote: { increment: jest.Mock };
  let client: FakeClient;
  let storage: RateLimitStorage;

  beforeEach(() => {
    // The class logs the degrade/recover transitions; keep the test output clean
    // while still asserting they happen exactly once.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    remote = { increment: jest.fn().mockResolvedValue(record(1)) };
    client = new FakeClient();
    storage = new RateLimitStorage(remote, client);
  });

  afterEach(() => {
    storage.onModuleDestroy();
    jest.restoreAllMocks();
  });

  it('counts in Redis while it is reachable', async () => {
    await expect(increment(storage)).resolves.toEqual(record(1));

    expect(remote.increment).toHaveBeenCalledWith(KEY, TTL, LIMIT, BLOCK, NAME);
    expect(storage.isDegraded).toBe(false);
    expect(storage.isRedisConfigured).toBe(true);
  });

  it('still counts, in memory, when Redis fails', async () => {
    remote.increment.mockRejectedValue(new Error('ECONNREFUSED'));

    // The point of the fallback: the request is served AND the hits keep
    // climbing. A Redis outage must not silently turn rate limiting off.
    const first = await increment(storage);
    const second = await increment(storage);

    expect(first.totalHits).toBe(1);
    expect(second.totalHits).toBe(2);
    expect(storage.isDegraded).toBe(true);
  });

  it('blocks on the in-memory path once the limit is exceeded', async () => {
    remote.increment.mockRejectedValue(new Error('ECONNREFUSED'));

    let last = await increment(storage);
    for (let i = 0; i < LIMIT; i += 1) last = await increment(storage);

    expect(last.isBlocked).toBe(true);
  });

  it('logs the outage once, not once per request', async () => {
    const errorLog = jest.spyOn(Logger.prototype, 'error');
    remote.increment.mockRejectedValue(new Error('ECONNREFUSED'));

    await increment(storage);
    await increment(storage);
    await increment(storage);

    expect(errorLog).toHaveBeenCalledTimes(1);
  });

  it('returns to Redis once it answers again', async () => {
    const recoveryLog = jest.spyOn(Logger.prototype, 'log');
    remote.increment.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await increment(storage);
    expect(storage.isDegraded).toBe(true);

    remote.increment.mockResolvedValue(record(9));
    await expect(increment(storage)).resolves.toEqual(record(9));

    expect(storage.isDegraded).toBe(false);
    expect(recoveryLog).toHaveBeenCalledTimes(1);
  });

  it('degrades on a connection-level error, before any request arrives', () => {
    const errorLog = jest.spyOn(Logger.prototype, 'error');

    client.emitError(new Error('connect ETIMEDOUT'));

    expect(storage.isDegraded).toBe(true);
    expect(errorLog).toHaveBeenCalledTimes(1);
  });

  it('closes the client without reconnecting on shutdown', () => {
    storage.onModuleDestroy();

    expect(client.disconnected).toBe(false);
  });

  describe('without a Redis configured', () => {
    it('counts in memory and reports itself as such', async () => {
      const memoryOnly = new RateLimitStorage(null, null);

      const first = await increment(memoryOnly);
      const second = await increment(memoryOnly);

      expect(first.totalHits).toBe(1);
      expect(second.totalHits).toBe(2);
      expect(memoryOnly.isRedisConfigured).toBe(false);
      // Not "degraded": nothing broke, this deployment simply has no Redis.
      expect(memoryOnly.isDegraded).toBe(false);

      memoryOnly.onModuleDestroy();
    });
  });
});

describe('redisOptionsForRateLimiting', () => {
  it('fails fast instead of queueing or retrying at length', () => {
    const options = redisOptionsForRateLimiting();

    expect(options.enableOfflineQueue).toBe(false);
    expect(options.maxRetriesPerRequest).toBe(1);
    expect(options.commandTimeout).toBeLessThanOrEqual(1_000);
  });

  it('backs off with jitter and never stops reconnecting', () => {
    const { retryStrategy } = redisOptionsForRateLimiting();
    if (typeof retryStrategy !== 'function')
      throw new Error('expected a function');

    const first = retryStrategy(1) as number;
    const later = retryStrategy(20) as number;

    expect(first).toBeGreaterThan(0);
    expect(later).toBeGreaterThan(first);
    // Capped, so a long outage does not push the reconnect interval to minutes.
    expect(later).toBeLessThanOrEqual(5_000);

    // Jitter: identical inputs must not produce a fleet reconnecting in lockstep.
    const draws = new Set(
      Array.from({ length: 20 }, () => retryStrategy(5) as number),
    );
    expect(draws.size).toBeGreaterThan(1);
  });
});
