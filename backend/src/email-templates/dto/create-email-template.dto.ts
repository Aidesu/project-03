import { EmailTemplateCategory } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateEmailTemplateDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsEnum(EmailTemplateCategory)
  category?: EmailTemplateCategory;

  @IsString()
  @MaxLength(200)
  subject!: string;

  // Plain text only — rendered as text client-side, never as HTML.
  @IsString()
  @MaxLength(5000)
  body!: string;
}
