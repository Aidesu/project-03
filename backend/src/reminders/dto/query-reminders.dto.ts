import { ReminderType } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export const REMINDER_STATUSES = [
  'pending',
  'completed',
  'overdue',
  'upcoming',
] as const;

export const REMINDER_SORT_FIELDS = ['dueAt', 'createdAt'] as const;

export class QueryRemindersDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  applicationId?: string;

  @IsOptional()
  @IsEnum(ReminderType)
  type?: ReminderType;

  @IsOptional()
  @IsIn(REMINDER_STATUSES)
  status?: (typeof REMINDER_STATUSES)[number];

  @IsOptional()
  @IsIn(REMINDER_SORT_FIELDS)
  sortBy: (typeof REMINDER_SORT_FIELDS)[number] = 'dueAt';

  // Soonest-due first by default.
  override sortOrder: 'asc' | 'desc' = 'asc';
}
