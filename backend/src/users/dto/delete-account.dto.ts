import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * The typed confirmation word, one per supported UI language. A German user
 * cannot sensibly be asked to type a French word, so the server accepts any of
 * them — the deliberate friction is the safeguard, not the specific string.
 */
export const DELETE_CONFIRMATION_WORDS = [
  'SUPPRIMER',
  'DELETE',
  'LÖSCHEN',
  'ELIMINAR',
] as const;

export class DeleteAccountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  currentPassword!: string;

  // Typed confirmation — the deliberate friction is the actual safeguard
  // against a single misclick or a forged request triggering irreversible
  // erasure; the password check alone isn't enough for a destructive action.
  @IsString()
  @IsIn(DELETE_CONFIRMATION_WORDS, {
    message: `Confirmation text must be one of: ${DELETE_CONFIRMATION_WORDS.join(', ')}.`,
  })
  confirmation!: string;
}
