import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';
import { RateLimitStorage } from './common/rate-limit.storage';

/**
 * Where rate-limit counters are actually being kept right now. `degraded` is
 * the case worth alerting on: the API is up and still limiting, but per
 * process, so the configured limits no longer hold across instances.
 */
export type RateLimitStore = 'redis' | 'degraded' | 'memory';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly rateLimitStorage: RateLimitStorage,
  ) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @SkipThrottle()
  @Get('health')
  getHealth(): {
    status: string;
    timestamp: string;
    rateLimitStore: RateLimitStore;
  } {
    // Deliberately still 200 when degraded: the container healthcheck reads
    // this endpoint, and replacing a working instance because Redis blipped
    // turns a degradation into an outage.
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      rateLimitStore: this.rateLimitStore(),
    };
  }

  private rateLimitStore(): RateLimitStore {
    if (!this.rateLimitStorage.isRedisConfigured) return 'memory';
    return this.rateLimitStorage.isDegraded ? 'degraded' : 'redis';
  }
}
