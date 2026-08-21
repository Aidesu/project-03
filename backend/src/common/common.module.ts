import { Module } from '@nestjs/common';
import { CorrelationIdMiddleware } from './correlation-id.middleware';
import { createRateLimitStorage, RateLimitStorage } from './rate-limit.storage';
import { UserTimezoneService } from './user-timezone.service';

/** Cross-cutting request plumbing (correlation ID, error shaping, time zones). */
@Module({
  providers: [
    CorrelationIdMiddleware,
    UserTimezoneService,
    // Provided here rather than inline in ThrottlerModule so the same instance
    // is injectable elsewhere — the health endpoint reports its state.
    { provide: RateLimitStorage, useFactory: () => createRateLimitStorage() },
  ],
  exports: [CorrelationIdMiddleware, UserTimezoneService, RateLimitStorage],
})
export class CommonModule {}
