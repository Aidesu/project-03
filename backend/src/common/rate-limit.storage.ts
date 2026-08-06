import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import Redis, { type RedisOptions } from 'ioredis';

/**
 * `ThrottlerStorageRecord` is not re-exported from the package root, and
 * reaching into `@nestjs/throttler/dist/...` would couple us to its build
 * layout. Derive it from the interface we actually implement instead.
 */
type StorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

/**
 * Rate limiting sits on the hot path of every request, so a stalled Redis must
 * surface as a fast error we can fall back from, not as latency added to each
 * call. 500 ms is far above a healthy round trip (sub-millisecond on the
 * container network, single-digit ms across AZs) and far below what a user
 * would notice.
 */
const COMMAND_TIMEOUT_MS = 500;
const CONNECT_TIMEOUT_MS = 2_000;
const RECONNECT_BASE_MS = 200;
const RECONNECT_MAX_MS = 5_000;

/** Just enough of ioredis for this class — keeps the unit tests off a real client. */
export interface RateLimitRedisClient {
  on(event: 'error', listener: (err: Error) => void): unknown;
  disconnect(reconnect?: boolean): void;
}

export function redisOptionsForRateLimiting(): RedisOptions {
  return {
    // One retry, then hand the error back so `increment` can fall back this
    // request instead of holding it while ioredis works through its default
    // 20 attempts.
    maxRetriesPerRequest: 1,
    commandTimeout: COMMAND_TIMEOUT_MS,
    connectTimeout: CONNECT_TIMEOUT_MS,
    // While disconnected, fail immediately rather than queueing commands that
    // would resolve only once Redis returns — a queued rate-limit check is a
    // hung request.
    enableOfflineQueue: false,
    // Exponential backoff with jitter so a fleet coming back up after an
    // outage does not reconnect in lockstep. Never gives up: the app stays
    // usable while degraded and repairs itself when Redis returns.
    retryStrategy: (times: number) =>
      Math.round(
        Math.min(
          RECONNECT_MAX_MS,
          RECONNECT_BASE_MS * 2 ** Math.min(times, 8),
        ) *
          (0.5 + Math.random() / 2),
      ),
  };
}

/**
 * Throttler storage backed by Redis, degrading to per-process memory.
 *
 * Redis is what makes a limit survive a restart and hold across instances —
 * in-memory counters reset on every deploy and multiply by the number of
 * processes. But putting Redis on the critical path of every request also
 * makes it a single point of failure for the whole API, so a Redis error
 * degrades to the in-memory counter rather than rejecting the request: an
 * outage must not take the API down, and must not switch rate limiting off
 * either.
 *
 * With no `REDIS_URL` configured (local runs, tests) this is purely the stock
 * in-memory storage. Production is required to set one — see env.validation.ts.
 */
@Injectable()
export class RateLimitStorage implements ThrottlerStorage, OnModuleDestroy {
  private readonly logger = new Logger(RateLimitStorage.name);
  private readonly memory = new ThrottlerStorageService();
  private degraded = false;

  constructor(
    private readonly remote: ThrottlerStorage | null,
    private readonly client: RateLimitRedisClient | null,
  ) {
    // ioredis emits `error` on every failed connection attempt. An
    // EventEmitter `error` with no listener terminates the process, so this
    // is an availability requirement, not diagnostics.
    this.client?.on('error', (err) => this.markDegraded(err));
  }

  /** True when Redis is unreachable and limits are being counted per process. */
  get isDegraded(): boolean {
    return this.degraded;
  }

  /** False when no Redis is configured at all, so health can tell the two apart. */
  get isRedisConfigured(): boolean {
    return this.remote !== null;
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<StorageRecord> {
    if (!this.remote) {
      return this.memory.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }

    try {
      const record = await this.remote.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
      this.markHealthy();
      return record;
    } catch (err) {
      this.markDegraded(err);
      return this.memory.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }
  }

  onModuleDestroy(): void {
    // Clears the pending decrement timers the in-memory storage schedules,
    // which would otherwise keep the event loop alive on shutdown.
    this.memory.onApplicationShutdown();
    this.client?.disconnect(false);
  }

  /** Logged on the transition only — a Redis outage would otherwise log per request. */
  private markDegraded(err: unknown): void {
    if (this.degraded) return;
    this.degraded = true;
    this.logger.error(
      'Redis unreachable — rate limits degraded to per-process counters',
      err instanceof Error ? err.stack : String(err),
    );
  }

  private markHealthy(): void {
    if (!this.degraded) return;
    this.degraded = false;
    // Counters accumulated in memory during the outage are not replayed into
    // Redis: the window they belong to is already partly gone, and a merge
    // would be guesswork. The limit is briefly more permissive, never less.
    this.logger.log(
      'Redis reachable again — rate limits back to shared counters',
    );
  }
}

/**
 * Builds the storage from the environment. Kept out of the class so the class
 * itself takes plain collaborators and stays unit-testable without a server.
 */
export function createRateLimitStorage(
  redisUrl = process.env.REDIS_URL,
): RateLimitStorage {
  if (!redisUrl) return new RateLimitStorage(null, null);

  const client = new Redis(redisUrl, redisOptionsForRateLimiting());
  return new RateLimitStorage(new ThrottlerStorageRedisService(client), client);
}
