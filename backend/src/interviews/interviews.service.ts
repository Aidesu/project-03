import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InterviewOutcome, Prisma, XpReason } from '@prisma/client';
import { paginated, skipTake } from '../common/pagination';
import { GamificationService } from '../gamification/gamification.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { QueryInterviewsDto } from './dto/query-interviews.dto';
import { UpdateInterviewDto } from './dto/update-interview.dto';

const INTERVIEW_INCLUDE = {
  contact: { select: { id: true, firstName: true, lastName: true } },
  application: {
    select: {
      id: true,
      position: true,
      companyName: true,
      company: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.InterviewInclude;

const XP_INTERVIEW_COMPLETED = 25;
const COMPLETED_OUTCOMES: InterviewOutcome[] = [
  InterviewOutcome.PASSED,
  InterviewOutcome.FAILED,
];
const isCompleted = (o: InterviewOutcome) => COMPLETED_OUTCOMES.includes(o);

@Injectable()
export class InterviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
  ) {}

  async create(userId: number, dto: CreateInterviewDto) {
    await this.assertApplication(userId, dto.applicationId);
    await this.assertContact(userId, dto.contactId);

    const outcome = dto.outcome ?? InterviewOutcome.PENDING;
    const interview = await this.prisma.interview.create({
      data: {
        applicationId: dto.applicationId,
        contactId: dto.contactId ?? null,
        type: dto.type,
        mode: dto.mode ?? null,
        scheduledAt: dto.scheduledAt ?? null,
        durationMinutes: dto.durationMinutes ?? null,
        location: dto.location ?? null,
        interviewerNames: dto.interviewerNames ?? null,
        notes: dto.notes ?? null,
        outcome,
      },
      include: INTERVIEW_INCLUDE,
    });

    if (isCompleted(outcome)) {
      await this.gamification.award(
        userId,
        XpReason.INTERVIEW_COMPLETED,
        XP_INTERVIEW_COMPLETED,
        dto.applicationId,
      );
    }

    return interview;
  }

  async findMany(userId: number, q: QueryInterviewsDto) {
    // Ownership is anchored on the parent application — interviews have no userId.
    const where: Prisma.InterviewWhereInput = { application: { userId } };
    if (q.applicationId) where.applicationId = q.applicationId;
    if (q.contactId) where.contactId = q.contactId;
    if (q.outcome) where.outcome = q.outcome;
    if (q.upcoming) {
      where.outcome = InterviewOutcome.PENDING;
      where.scheduledAt = { gte: new Date() };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.interview.findMany({
        where,
        include: INTERVIEW_INCLUDE,
        orderBy: { [q.sortBy]: q.sortOrder },
        ...skipTake(q.page, q.pageSize),
      }),
      this.prisma.interview.count({ where }),
    ]);

    return paginated(items, total, q.page, q.pageSize);
  }

  async findOne(userId: number, id: string) {
    const interview = await this.prisma.interview.findFirst({
      where: { id, application: { userId } },
      include: INTERVIEW_INCLUDE,
    });
    if (!interview) throw new NotFoundException('Interview not found');
    return interview;
  }

  async update(userId: number, id: string, dto: UpdateInterviewDto) {
    const existing = await this.findOwnedOrThrow(userId, id);
    await this.assertContact(userId, dto.contactId);

    const interview = await this.prisma.interview.update({
      where: { id },
      data: {
        contactId: dto.contactId,
        type: dto.type,
        mode: dto.mode,
        scheduledAt: dto.scheduledAt,
        durationMinutes: dto.durationMinutes,
        location: dto.location,
        interviewerNames: dto.interviewerNames,
        notes: dto.notes,
        outcome: dto.outcome,
      },
      include: INTERVIEW_INCLUDE,
    });

    // Award once, when the interview first transitions into a completed outcome.
    const newOutcome = dto.outcome ?? existing.outcome;
    if (!isCompleted(existing.outcome) && isCompleted(newOutcome)) {
      await this.gamification.award(
        userId,
        XpReason.INTERVIEW_COMPLETED,
        XP_INTERVIEW_COMPLETED,
        existing.applicationId,
      );
    }

    return interview;
  }

  async remove(userId: number, id: string): Promise<void> {
    await this.findOwnedOrThrow(userId, id);
    await this.prisma.interview.delete({ where: { id } });
  }

  private async findOwnedOrThrow(userId: number, id: string) {
    const interview = await this.prisma.interview.findFirst({
      where: { id, application: { userId } },
    });
    if (!interview) throw new NotFoundException('Interview not found');
    return interview;
  }

  private async assertApplication(userId: number, applicationId: string) {
    const found = await this.prisma.jobApplication.count({
      where: { id: applicationId, userId },
    });
    if (!found) throw new BadRequestException('Unknown application');
  }

  private async assertContact(userId: number, contactId?: string) {
    if (!contactId) return;
    const found = await this.prisma.contact.count({
      where: { id: contactId, userId },
    });
    if (!found) throw new BadRequestException('Unknown contact');
  }
}
