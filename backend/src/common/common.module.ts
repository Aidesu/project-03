import { Module } from '@nestjs/common';
import { CorrelationIdMiddleware } from './correlation-id.middleware';

/** Cross-cutting request plumbing (correlation ID, error shaping). */
@Module({
  providers: [CorrelationIdMiddleware],
  exports: [CorrelationIdMiddleware],
})
export class CommonModule {}
