import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { IsIanaTimezone } from './is-timezone.validator';

// Authoritative allowlist. Keep in sync with the frontend's
// core/i18n/locale.ts — the server decides, the client only offers.
export const SUPPORTED_LOCALES = ['fr', 'en', 'de', 'es'] as const;

export class UpdateSettingsDto {
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: string;

  @IsOptional()
  @IsString()
  @IsIanaTimezone()
  timezone?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  weeklyApplicationGoal?: number;

  @IsOptional()
  @IsBoolean()
  emailRemindersEnabled?: boolean;
}
