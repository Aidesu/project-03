import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

// Generous but bounded: the raw token is 32 random bytes in base64url (43
// chars). The cap is what stops a caller making the server hash megabytes.
const TOKEN_MAX_LENGTH = 512;

export class ForgotPasswordDto {
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MaxLength(TOKEN_MAX_LENGTH)
  token!: string;

  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters long.' })
  @MaxLength(128)
  password!: string;
}

export class VerifyEmailDto {
  @IsString()
  @MaxLength(TOKEN_MAX_LENGTH)
  token!: string;
}
