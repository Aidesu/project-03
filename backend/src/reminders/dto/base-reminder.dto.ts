import { ReminderType } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** Shared optional fields; `title`/`dueAt` are required on create (subclass). */
export class BaseReminderDto {
  @IsOptional()
  @IsUUID()
  applicationId?: string;

  @IsOptional()
  @IsEnum(ReminderType)
  type?: ReminderType;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
