import { InterviewType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { BaseInterviewDto } from './base-interview.dto';

// All fields optional; an interview cannot be moved to another application.
export class UpdateInterviewDto extends BaseInterviewDto {
  @IsOptional()
  @IsEnum(InterviewType)
  type?: InterviewType;
}
