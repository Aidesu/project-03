import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateAccountDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  // Only required when `email` is being changed — enforced here rather than
  // relying on the client, since re-authentication before a sensitive change
  // (account-recovery address) must hold even if a session cookie is stolen.
  @ValidateIf((o: UpdateAccountDto) => !!o.email)
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  currentPassword?: string;
}
