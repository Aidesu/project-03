import { Transform } from 'class-transformer';
import { InterviewOutcome } from '@prisma/client';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import {
  PaginationQueryDto,
  toOptionalBool,
} from '../../common/dto/pagination-query.dto';

export const INTERVIEW_SORT_FIELDS = ['scheduledAt', 'createdAt'] as const;

export class QueryInterviewsDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  applicationId?: string;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @IsEnum(InterviewOutcome)
  outcome?: InterviewOutcome;

  // Only future, still-pending interviews (handy for a dashboard agenda).
  @IsOptional()
  @Transform(toOptionalBool)
  @IsBoolean()
  upcoming?: boolean;

  @IsOptional()
  @IsIn(INTERVIEW_SORT_FIELDS)
  sortBy: (typeof INTERVIEW_SORT_FIELDS)[number] = 'scheduledAt';
}
