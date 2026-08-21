import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RateLimitStorage } from './common/rate-limit.storage';

describe('AppController', () => {
  let appController: AppController;
  const storage = {
    isRedisConfigured: true,
    isDegraded: false,
  };

  beforeEach(async () => {
    storage.isRedisConfigured = true;
    storage.isDegraded = false;

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: RateLimitStorage, useValue: storage }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('reports the rate limiter as shared when Redis answers', () => {
      expect(appController.getHealth()).toMatchObject({
        status: 'ok',
        rateLimitStore: 'redis',
      });
    });

    // Still `ok`: the compose/orchestrator healthcheck reads this, and killing a
    // working instance because Redis blipped turns a degradation into an outage.
    it('stays healthy but flags the degraded store when Redis is unreachable', () => {
      storage.isDegraded = true;

      expect(appController.getHealth()).toMatchObject({
        status: 'ok',
        rateLimitStore: 'degraded',
      });
    });

    it('distinguishes "no Redis configured" from "Redis down"', () => {
      storage.isRedisConfigured = false;

      expect(appController.getHealth().rateLimitStore).toBe('memory');
    });
  });
});
