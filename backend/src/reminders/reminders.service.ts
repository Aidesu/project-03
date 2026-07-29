import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReminderType } from '@prisma/client';
import { paginated, skipTake } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { QueryRemindersDto } from './dto/query-reminders.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';

const REMINDER_INCLUDE = {
  application: { select: { id: true, position: true, companyName: true } },
} satisfies Prisma.ReminderInclude;

@Injectable()
export class RemindersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, dto: CreateReminderDto) {
    await this.assertApplication(userId, dto.applicationId);
    return this.prisma.reminder.create({
      data: {
        userId,
        applicationId: dto.applicationId ?? null,
        type: dto.type ?? ReminderType.CUSTOM,
        title: dto.title,
        notes: dto.notes ?? null,
        dueAt: dto.dueAt,
      },
      include: REMINDER_INCLUDE,
    });
  }

  async findMany(userId: number, q: QueryRemindersDto) {
    const where: Prisma.ReminderWhereInput = { userId };
    if (q.applicationId) where.applicationId = q.applicationId;
    if (q.type) where.type = q.type;

    const now = new Date();
    switch (q.status) {
      case 'pending':
        where.completedAt = null;
        break;
      case 'completed':
        where.completedAt = { not: null };
        break;
      case 'overdue':
        where.completedAt = null;
        where.dueAt = { lt: now };
        break;
      case 'upcoming':
        where.completedAt = null;
        where.dueAt = { gte: now };
        break;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.reminder.findMany({
        where,
        include: REMINDER_INCLUDE,
        orderBy: { [q.sortBy]: q.sortOrder },
        ...skipTake(q.page, q.pageSize),
      }),
      this.prisma.reminder.count({ where }),
    ]);

    return paginated(items, total, q.page, q.pageSize);
  }

  async findOne(userId: number, id: string) {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id, userId },
      include: REMINDER_INCLUDE,
    });
    if (!reminder) throw new NotFoundException('Reminder not found');
    return reminder;
  }

  async update(userId: number, id: string, dto: UpdateReminderDto) {
    await this.findOwnedOrThrow(userId, id);
    await this.assertApplication(userId, dto.applicationId);

    const data: Prisma.ReminderUncheckedUpdateInput = {
      applicationId: dto.applicationId,
      type: dto.type,
      title: dto.title,
      notes: dto.notes,
      dueAt: dto.dueAt,
    };
    if (dto.isCompleted !== undefined) {
      data.completedAt = dto.isCompleted ? new Date() : null;
    }

    return this.prisma.reminder.update({
      where: { id },
      data,
      include: REMINDER_INCLUDE,
    });
  }

  async remove(userId: number, id: string): Promise<void> {
    await this.findOwnedOrThrow(userId, id);
    await this.prisma.reminder.delete({ where: { id } });
  }

  private async findOwnedOrThrow(userId: number, id: string) {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id, userId },
    });
    if (!reminder) throw new NotFoundException('Reminder not found');
    return reminder;
  }

  private async assertApplication(userId: number, applicationId?: string) {
    if (!applicationId) return;
    const found = await this.prisma.jobApplication.count({
      where: { id: applicationId, userId },
    });
    if (!found) throw new BadRequestException('Unknown application');
  }
}
