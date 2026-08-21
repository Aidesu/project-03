import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

/**
 * Long enough for someone to open the export and fetch the picture, short
 * enough that the link in a file sitting in a Downloads folder stops working.
 */
const AVATAR_PRESIGN_TTL_SECONDS = 900;

/** Bumped whenever the shape changes, so an older file stays interpretable. */
const EXPORT_FORMAT = 'project-03/user-export';
const EXPORT_VERSION = 2;

/**
 * GDPR access and portability (Art. 15 / Art. 20): everything the product holds
 * about one account, in one machine-readable document.
 *
 * Two rules govern what goes in, and they pull in opposite directions:
 *
 * - Completeness. A column added later must appear here by default, otherwise
 *   the export silently degrades into a partial answer. Domain tables are
 *   therefore read whole, with only the redundant `userId` omitted.
 * - No credentials. Password hashes and token hashes are the one category that
 *   must never leave the database, even towards their owner — an exported hash
 *   is an offline cracking target, and it is not information about the person.
 *   Those tables get an explicit allowlist instead.
 */
@Injectable()
export class DataExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async exportForUser(
    userId: number,
    ctx: RequestContext,
  ): Promise<Record<string, unknown>> {
    // Allowlisted: this row holds the password hash and the internal keys.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        publicId: true,
        email: true,
        emailVerifiedAt: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        avatarStorageKey: true,
      },
    });
    if (!user) throw new ForbiddenException('User no longer exists');

    // One transaction so the document is a consistent snapshot rather than a
    // set of reads taken at different moments.
    const [
      settings,
      companies,
      contacts,
      applications,
      statusHistory,
      documents,
      emailTemplates,
      gamification,
      xpEvents,
      achievements,
      sessions,
      securityEvents,
    ] = await this.prisma.$transaction([
      this.prisma.userSettings.findUnique({
        where: { userId },
        omit: { id: true, userId: true },
      }),
      this.prisma.company.findMany({
        where: { userId },
        omit: { userId: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.contact.findMany({
        where: { userId },
        omit: { userId: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.jobApplication.findMany({
        where: { userId },
        omit: { userId: true },
        orderBy: { createdAt: 'asc' },
      }),
      // No userId column of their own: scoped through the owning application,
      // at the query layer, so an unscoped read is not expressible here.
      this.prisma.applicationStatusEvent.findMany({
        where: { application: { userId } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.document.findMany({
        where: { userId },
        omit: { userId: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.emailTemplate.findMany({
        where: { userId },
        omit: { userId: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.gamificationProfile.findUnique({
        where: { userId },
        omit: { id: true, userId: true },
      }),
      this.prisma.xpEvent.findMany({
        where: { userId },
        omit: { userId: true },
        orderBy: { createdAt: 'asc' },
      }),
      // The catalog rows are shared product content, not personal data — only
      // the code and label are pulled in, to make the unlock intelligible.
      this.prisma.userAchievement.findMany({
        where: { userId },
        omit: { userId: true },
        include: {
          achievement: {
            select: { code: true, name: true, description: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      // Allowlisted: `tokenHash` is a session credential.
      this.prisma.refreshSession.findMany({
        where: { userId },
        select: {
          id: true,
          familyId: true,
          createdAt: true,
          expiresAt: true,
          revokedAt: true,
          ip: true,
          userAgent: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.auditLog.findMany({
        where: { userId },
        omit: { userId: true },
        orderBy: { occurredAt: 'asc' },
      }),
    ]);

    const { avatarStorageKey, ...profile } = user;

    // Recorded once the read has succeeded: an export is a bulk copy of
    // personal data leaving the system, which is the operation an auditor will
    // always ask to see a trace of.
    await this.audit.success(AuditAction.DATA_EXPORTED, {
      userId,
      context: ctx,
    });

    return {
      meta: {
        format: EXPORT_FORMAT,
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        // Stated in the file itself: an export is a snapshot, and it is not
        // the same thing as having asked for deletion.
        notice:
          'Complete copy of the data held for this account at the time of export. ' +
          'Timestamps are UTC (ISO 8601). Requesting an export does not delete anything.',
      },
      profile: {
        ...profile,
        // Presigned and short-lived: the bytes live in object storage, so the
        // export carries a way to fetch them rather than the image itself.
        avatarUrl: avatarStorageKey
          ? await this.storage.presignGet(
              avatarStorageKey,
              AVATAR_PRESIGN_TTL_SECONDS,
            )
          : null,
        avatarUrlExpiresInSeconds: avatarStorageKey
          ? AVATAR_PRESIGN_TTL_SECONDS
          : null,
      },
      settings,
      companies,
      contacts,
      applications,
      applicationStatusHistory: statusHistory,
      documents,
      emailTemplates,
      gamification: { profile: gamification, xpEvents, achievements },
      // Observed rather than provided data: strictly an Art. 15 access matter,
      // included so the account's own security history is visible to it.
      security: { sessions, events: securityEvents },
    };
  }
}
