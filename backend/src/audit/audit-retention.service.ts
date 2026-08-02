import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditService } from './audit.service';

/**
 * A year covers the usual "show me the last 12 months of access" question from
 * an auditor without keeping IP addresses around forever. Override per
 * deployment when a contract or a local rule says otherwise.
 */
export const DEFAULT_AUDIT_RETENTION_DAYS = 365;

/**
 * Applies the audit-log retention window.
 *
 * Runs on every instance rather than through a lock: deleting by date is
 * idempotent, so a concurrent run costs a wasted query, never a wrong result.
 * Revisit if the table ever grows enough for the DELETE to be expensive.
 */
@Injectable()
export class AuditRetentionService {
  private readonly logger = new Logger(AuditRetentionService.name);
  private readonly retentionDays = Number(
    process.env.AUDIT_LOG_RETENTION_DAYS ?? DEFAULT_AUDIT_RETENTION_DAYS,
  );

  constructor(private readonly audit: AuditService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredEntries(): Promise<void> {
    try {
      const deleted = await this.audit.purgeOlderThan(this.retentionDays);
      if (deleted > 0) {
        this.logger.log(
          `Purged ${deleted} audit entries older than ${this.retentionDays} days`,
        );
      }
    } catch (err) {
      // A failed purge is a compliance problem (data kept past its window),
      // not an availability one — log it, never take the process down.
      this.logger.error(
        'Audit log retention purge failed',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
