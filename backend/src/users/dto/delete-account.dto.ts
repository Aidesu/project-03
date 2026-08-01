import { Equals, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DeleteAccountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  currentPassword!: string;

  // Typed confirmation — the deliberate friction is the actual safeguard
  // against a single misclick or a forged request triggering irreversible
  // erasure; the password check alone isn't enough for a destructive action.
  @IsString()
  @Equals('SUPPRIMER', { message: 'Confirmation text must be "SUPPRIMER".' })
  confirmation!: string;
}
