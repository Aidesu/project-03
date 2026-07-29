import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { BaseReminderDto } from './base-reminder.dto';

export class UpdateReminderDto extends BaseReminderDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueAt?: Date;

  // Toggle completion: true stamps completedAt now, false clears it.
  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;
}
