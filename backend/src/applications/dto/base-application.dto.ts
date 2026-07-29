import { Type } from 'class-transformer';
import {
  ApplicationSource,
  ApplicationStatus,
  EmploymentType,
  Priority,
  SalaryPeriod,
  WorkMode,
} from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Shared optional fields for creating/updating an application.
 * `position` (required on create, optional on update) and `status`
 * (changed via the dedicated endpoint) are declared in the subclasses.
 */
export class BaseApplicationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsEnum(ApplicationSource)
  source?: ApplicationSource;

  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  jobUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsEnum(WorkMode)
  workMode?: WorkMode;

  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  excitement?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMax?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  salaryCurrency?: string;

  @IsOptional()
  @IsEnum(SalaryPeriod)
  salaryPeriod?: SalaryPeriod;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  appliedAt?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  deadlineAt?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;

  // Update-only: archive/unarchive (ignored on create).
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;

  @IsOptional()
  @IsUUID()
  primaryContactId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  tagIds?: string[];

  // Allowed at creation; on update use the /status endpoint instead.
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;
}
