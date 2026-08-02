import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

/**
 * PATCH semantics: an absent key leaves the column untouched, while an
 * explicit `null` clears it. `@IsOptional()` skips validation for both, so
 * the nullable types below are what actually reaches Prisma.
 */
export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  website?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  industry?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  size?: string | null;

  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  logoUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;
}
