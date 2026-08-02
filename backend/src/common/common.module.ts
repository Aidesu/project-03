import { Module } from '@nestjs/common';
import { CorrelationIdMiddleware } from './correlation-id.middleware';
import { UserTimezoneService } from './user-timezone.service';

/** Cross-cutting request plumbing (correlation ID, error shaping, time zones). */
@Module({
  providers: [CorrelationIdMiddleware, UserTimezoneService],
  exports: [CorrelationIdMiddleware, UserTimezoneService],
})
export class CommonModule {}
