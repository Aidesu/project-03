import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

/**
 * A dead session row is only useful to answer "where was this account signed in
 * recently", and the audit trail already records the events that matter with a
 * far longer window. 30 days keeps the session list's history honest without
 * turning the table into an indefinite log of the user's IP addresses.
 */
export const DEFAULT_SESSION_RETENTION_DAYS = 30;

/**
 * Deletes revoked and expired refresh sessions past the retention window.
 *
 * These rows carry an IP address and a user agent — personal data, kept until
 * now with no policy at all. Live sessions are never touched: the window is
 * measured from the moment a row stopped being usable.
 *
 * Like the audit purge, this runs on every instance rather than behind a lock:
 * deleting by date is idempotent, so a concurrent run wastes a query instead of
 * producing a wrong result.
 */
@Injectable()
export class SessionRetentionService {
  private readonly logger = new Logger(SessionRetentionService.name);
  private readonly retentionDays = Number(
    process.env.SESSION_RETENTION_DAYS ?? DEFAULT_SESSION_RETENTION_DAYS,
  );

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purgeDeadSessions(): Promise<void> {
    try {
      const deleted = await this.purgeOlderThan(this.retentionDays);
      if (deleted > 0) {
        this.logger.log(
          `Purged ${deleted} dead refresh sessions older than ${this.retentionDays} days`,
        );
      }
    } catch (err) {
      // Keeping personal data past its window is a compliance problem, not an
      // availability one — log it, never take the process down.
      this.logger.error(
        'Refresh session retention purge failed',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  async purgeOlderThan(days: number): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const { count } = await this.prisma.refreshSession.deleteMany({
      where: {
        OR: [
          { revokedAt: { lt: cutoff } },
          // Expired without ever being revoked — the row died at expiresAt.
          { revokedAt: null, expiresAt: { lt: cutoff } },
        ],
      },
    });
    return count;
  }
}
