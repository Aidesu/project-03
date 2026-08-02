import { Global, Module } from '@nestjs/common';
import { AuditRetentionService } from './audit-retention.service';
import { AuditService } from './audit.service';

/**
 * Global, like PrismaModule: auditing is cross-cutting by nature and every
 * module that touches credentials needs it. Threading an import through each
 * of them would only add ceremony — and an easy excuse to skip the audit call.
 */
@Global()
@Module({
  providers: [AuditService, AuditRetentionService],
  exports: [AuditService],
})
export class AuditModule {}
