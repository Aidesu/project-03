import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStatus,
  JobApplication,
  Prisma,
  XpReason,
} from '@prisma/client';
import {
  addCalendarDays,
  calendarDayIn,
  earliestInstantOfCalendarDay,
} from '../common/timezone';
import { UserTimezoneService } from '../common/user-timezone.service';
import { PrismaService } from '../prisma/prisma.service';
import { CompaniesService } from '../companies/companies.service';
import { GamificationService } from '../gamification/gamification.service';
import { ChangeStatusDto } from './dto/change-status.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { DailyStatsQueryDto } from './dto/daily-stats-query.dto';
import { QueryApplicationsDto } from './dto/query-applications.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';

const APPLICATION_DETAIL_INCLUDE = {
  company: true,
  primaryContact: true,
  tags: { include: { tag: true } },
  interviews: { orderBy: { scheduledAt: 'asc' } },
  statusHistory: { orderBy: { createdAt: 'asc' } },
  _count: { select: { documents: true, reminders: true } },
} satisfies Prisma.JobApplicationInclude;

const APPLICATION_LIST_INCLUDE = {
  company: { select: { id: true, name: true, logoUrl: true } },
  tags: { include: { tag: true } },
  _count: { select: { interviews: true } },
} satisfies Prisma.JobApplicationInclude;

// XP awards
const XP_APPLICATION_CREATED = 10;
const STATUS_XP: Partial<
  Record<ApplicationStatus, { reason: XpReason; amount: number }>
> = {
  [ApplicationStatus.APPLIED]: {
    reason: XpReason.APPLICATION_SUBMITTED,
    amount: 20,
  },
  [ApplicationStatus.INTERVIEW]: {
    reason: XpReason.INTERVIEW_SCHEDULED,
    amount: 30,
  },
  [ApplicationStatus.OFFER]: { reason: XpReason.OFFER_RECEIVED, amount: 50 },
  [ApplicationStatus.ACCEPTED]: {
    reason: XpReason.OFFER_ACCEPTED,
    amount: 100,
  },
};

const TERMINAL_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.ACCEPTED,
  ApplicationStatus.REJECTED,
  ApplicationStatus.WITHDRAWN,
  ApplicationStatus.GHOSTED,
];

const APPLIED_STAGES: ApplicationStatus[] = [
  ApplicationStatus.APPLIED,
  ApplicationStatus.SCREENING,
  ApplicationStatus.INTERVIEW,
  ApplicationStatus.TECHNICAL_TEST,
  ApplicationStatus.OFFER,
  ApplicationStatus.ACCEPTED,
];

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
    private readonly companies: CompaniesService,
    private readonly timezones: UserTimezoneService,
  ) {}

  async create(userId: number, dto: CreateApplicationDto) {
    await this.assertRefs(
      userId,
      dto.companyId,
      dto.primaryContactId,
      dto.tagIds,
    );

    const status = dto.status ?? ApplicationStatus.WISHLIST;
    const now = new Date();
    const companyId =
      dto.companyId ?? (await this.resolveCompanyId(userId, dto.companyName));

    const application = await this.prisma.jobApplication.create({
      data: {
        userId,
        position: dto.position,
        companyId,
        companyName: dto.companyName ?? null,
        description: dto.description ?? null,
        status,
        source: dto.source ?? null,
        jobUrl: dto.jobUrl ?? null,
        location: dto.location ?? null,
        workMode: dto.workMode ?? null,
        employmentType: dto.employmentType ?? null,
        priority: dto.priority,
        excitement: dto.excitement ?? null,
        salaryMin: dto.salaryMin ?? null,
        salaryMax: dto.salaryMax ?? null,
        salaryCurrency: dto.salaryCurrency,
        salaryPeriod: dto.salaryPeriod,
        appliedAt:
          dto.appliedAt ?? (APPLIED_STAGES.includes(status) ? now : null),
        deadlineAt: dto.deadlineAt ?? null,
        closedAt: TERMINAL_STATUSES.includes(status) ? now : null,
        notes: dto.notes ?? null,
        isFavorite: dto.isFavorite,
        primaryContactId: dto.primaryContactId ?? null,
        tags: dto.tagIds?.length
          ? { create: dto.tagIds.map((tagId) => ({ tagId })) }
          : undefined,
        statusHistory: { create: { toStatus: status } },
      },
      include: APPLICATION_DETAIL_INCLUDE,
    });

    await this.gamification.award(
      userId,
      XpReason.APPLICATION_CREATED,
      XP_APPLICATION_CREATED,
      application.id,
    );
    const milestone = STATUS_XP[status];
    if (milestone) {
      await this.gamification.award(
        userId,
        milestone.reason,
        milestone.amount,
        application.id,
      );
    }

    return application;
  }

  async findMany(userId: number, q: QueryApplicationsDto) {
    const where: Prisma.JobApplicationWhereInput = { userId };
    if (q.status) where.status = q.status;
    if (q.companyId) where.companyId = q.companyId;
    if (q.isFavorite !== undefined) where.isFavorite = q.isFavorite;
    if (!q.includeArchived) where.archivedAt = null;
    if (q.tagId) where.tags = { some: { tagId: q.tagId } };
    if (q.search) {
      where.OR = [
        { position: { contains: q.search, mode: 'insensitive' } },
        { companyName: { contains: q.search, mode: 'insensitive' } },
        { company: { name: { contains: q.search, mode: 'insensitive' } } },
      ];
    }

    const orderBy = {
      [q.sortBy]: q.sortOrder,
    } as Prisma.JobApplicationOrderByWithRelationInput;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.jobApplication.findMany({
        where,
        include: APPLICATION_LIST_INCLUDE,
        orderBy,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.jobApplication.count({ where }),
    ]);

    return {
      items,
      total,
      page: q.page,
      pageSize: q.pageSize,
      pageCount: Math.ceil(total / q.pageSize),
    };
  }

  async findOne(userId: number, id: string) {
    const application = await this.prisma.jobApplication.findFirst({
      where: { id, userId },
      include: APPLICATION_DETAIL_INCLUDE,
    });
    if (!application) throw new NotFoundException('Application not found');
    return application;
  }

  async update(userId: number, id: string, dto: UpdateApplicationDto) {
    await this.findOwnedOrThrow(userId, id);
    await this.assertRefs(
      userId,
      dto.companyId,
      dto.primaryContactId,
      dto.tagIds,
    );

    // The form still posts free-text `companyName`; resolve it to a real
    // Company row so the application shows up under that company in the
    // network page. An explicit companyId always wins over this resolution.
    const companyId =
      dto.companyId === undefined && dto.companyName !== undefined
        ? await this.resolveCompanyId(userId, dto.companyName)
        : dto.companyId;

    // `status` is intentionally omitted — use changeStatus() so history/XP are tracked.
    const data: Prisma.JobApplicationUncheckedUpdateInput = {
      position: dto.position,
      companyId,
      companyName: dto.companyName,
      description: dto.description,
      source: dto.source,
      jobUrl: dto.jobUrl,
      location: dto.location,
      workMode: dto.workMode,
      employmentType: dto.employmentType,
      priority: dto.priority,
      excitement: dto.excitement,
      salaryMin: dto.salaryMin,
      salaryMax: dto.salaryMax,
      salaryCurrency: dto.salaryCurrency,
      salaryPeriod: dto.salaryPeriod,
      appliedAt: dto.appliedAt,
      deadlineAt: dto.deadlineAt,
      notes: dto.notes,
      isFavorite: dto.isFavorite,
      primaryContactId: dto.primaryContactId,
    };
    if (dto.isArchived !== undefined) {
      data.archivedAt = dto.isArchived ? new Date() : null;
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.tagIds !== undefined) {
        await tx.applicationTag.deleteMany({ where: { applicationId: id } });
        if (dto.tagIds.length) {
          data.tags = { create: dto.tagIds.map((tagId) => ({ tagId })) };
        }
      }
      return tx.jobApplication.update({
        where: { id },
        data,
        include: APPLICATION_DETAIL_INCLUDE,
      });
    });
  }

  async changeStatus(userId: number, id: string, dto: ChangeStatusDto) {
    const existing = await this.findOwnedOrThrow(userId, id);
    const from = existing.status;
    const to = dto.status;
    const now = new Date();

    const data: Prisma.JobApplicationUncheckedUpdateInput = { status: to };
    if (APPLIED_STAGES.includes(to) && !existing.appliedAt)
      data.appliedAt = now;
    data.closedAt = TERMINAL_STATUSES.includes(to)
      ? (existing.closedAt ?? now)
      : null;

    const application = await this.prisma.$transaction(async (tx) => {
      // Record the transition first so the returned include reflects it.
      if (from !== to) {
        await tx.applicationStatusEvent.create({
          data: {
            applicationId: id,
            fromStatus: from,
            toStatus: to,
            note: dto.note ?? null,
          },
        });
      }
      return tx.jobApplication.update({
        where: { id },
        data,
        include: APPLICATION_DETAIL_INCLUDE,
      });
    });

    if (from !== to) {
      const milestone = STATUS_XP[to];
      if (milestone) {
        await this.gamification.award(
          userId,
          milestone.reason,
          milestone.amount,
          id,
        );
      }
    }

    return application;
  }

  async remove(userId: number, id: string): Promise<void> {
    await this.findOwnedOrThrow(userId, id);
    await this.prisma.jobApplication.delete({ where: { id } });
  }

  /**
   * Applications created per day, oldest first — the dashboard trend chart and
   * heatmap. Days are the user's own calendar days: someone applying at 00:30
   * in Europe/Paris must see it on today's bar, not yesterday's.
   *
   * The range query is deliberately over-inclusive at its lower bound (see
   * {@link earliestInstantOfCalendarDay}); rows outside the requested window
   * are dropped by the bucket lookup below.
   */
  async dailyStats(
    userId: number,
    query: DailyStatsQueryDto,
  ): Promise<{ date: string; count: number }[]> {
    const { days } = query;
    const timeZone = await this.timezones.forUser(userId);
    const firstDay = addCalendarDays(
      calendarDayIn(new Date(), timeZone),
      -(days - 1),
    );

    const applications = await this.prisma.jobApplication.findMany({
      where: {
        userId,
        createdAt: { gte: earliestInstantOfCalendarDay(firstDay, timeZone) },
      },
      select: { createdAt: true },
    });

    const buckets = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      buckets.set(addCalendarDays(firstDay, i), 0);
    }
    for (const { createdAt } of applications) {
      const key = calendarDayIn(createdAt, timeZone);
      const count = buckets.get(key);
      if (count !== undefined) buckets.set(key, count + 1);
    }

    return Array.from(buckets, ([date, count]) => ({ date, count }));
  }

  // --- helpers ---

  /**
   * Find-or-create the user's Company matching this free-text name
   * (case-insensitive), so applications don't just store a disconnected
   * string and the company gets a real row in the user's network.
   * Returns null for a blank/absent name.
   */
  private async resolveCompanyId(
    userId: number,
    companyName: string | null | undefined,
  ): Promise<string | null> {
    const name = companyName?.trim();
    if (!name) return null;

    const existing = await this.prisma.company.findFirst({
      where: { userId, name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) return existing.id;

    const created = await this.companies.create(userId, { name });
    return created.id;
  }

  private async findOwnedOrThrow(
    userId: number,
    id: string,
  ): Promise<JobApplication> {
    const application = await this.prisma.jobApplication.findFirst({
      where: { id, userId },
    });
    if (!application) throw new NotFoundException('Application not found');
    return application;
  }

  /** Ensure referenced company/contact/tags all belong to the same user. */
  private async assertRefs(
    userId: number,
    companyId?: string,
    primaryContactId?: string,
    tagIds?: string[],
  ): Promise<void> {
    if (companyId) {
      const found = await this.prisma.company.count({
        where: { id: companyId, userId },
      });
      if (!found) throw new BadRequestException('Unknown company');
    }
    if (primaryContactId) {
      const found = await this.prisma.contact.count({
        where: { id: primaryContactId, userId },
      });
      if (!found) throw new BadRequestException('Unknown contact');
    }
    if (tagIds && tagIds.length) {
      const unique = [...new Set(tagIds)];
      const found = await this.prisma.tag.count({
        where: { id: { in: unique }, userId },
      });
      if (found !== unique.length) {
        throw new BadRequestException('One or more tags are unknown');
      }
    }
  }
}
