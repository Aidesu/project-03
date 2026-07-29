import { InterviewType } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';
import { BaseInterviewDto } from './base-interview.dto';

export class CreateInterviewDto extends BaseInterviewDto {
  @IsUUID()
  applicationId!: string;

  @IsEnum(InterviewType)
  type!: InterviewType;
}
