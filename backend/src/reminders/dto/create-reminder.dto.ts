import { Type } from 'class-transformer';
import { IsDate, IsString, MaxLength } from 'class-validator';
import { BaseReminderDto } from './base-reminder.dto';

export class CreateReminderDto extends BaseReminderDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @Type(() => Date)
  @IsDate()
  dueAt!: Date;
}
