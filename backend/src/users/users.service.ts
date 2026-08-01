import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { Role, User, UserSettings } from '@prisma/client';
import sharp from 'sharp';
import { ARGON2_OPTIONS } from '../auth/password.util';
import { RefreshContext, TokenService } from '../auth/token.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const AVATAR_MAX_DIMENSION = 512;
const AVATAR_PRESIGN_TTL_SECONDS = 300;

/** A user safe to expose over the API (password hash and storage key stripped). */
export type SafeUser = Omit<User, 'passwordHash' | 'avatarStorageKey'> & {
  avatarUrl: string | null;
};

/**
 * Build the client-safe view of a user. Uses an explicit allowlist (not an
 * exclusion) so a future sensitive column can never leak by accident.
 */
export function toSafeUser(
  user: User,
  avatarUrl: string | null = null,
): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    avatarUrl,
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly tokens: TokenService,
  ) {}

  findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  create(data: {
    email: string;
    passwordHash: string;
    name?: string | null;
    role?: Role;
  }): Promise<User> {
    return this.prisma.user.create({ data });
  }

  /** The single place `SafeUser` views are assembled — resolves the avatar's presigned URL. */
  async presentUser(user: User): Promise<SafeUser> {
    const avatarUrl = user.avatarStorageKey
      ? await this.storage.presignGet(
          user.avatarStorageKey,
          AVATAR_PRESIGN_TTL_SECONDS,
        )
      : null;
    return toSafeUser(user, avatarUrl);
  }

  async updateAccount(
    userId: number,
    dto: UpdateAccountDto,
  ): Promise<SafeUser> {
    const user = await this.requireUser(userId);

    const data: { name?: string | null; email?: string } = {};

    if (dto.name !== undefined) {
      data.name = dto.name.length > 0 ? dto.name : null;
    }

    if (dto.email !== undefined && dto.email !== user.email) {
      // currentPassword presence is enforced by UpdateAccountDto's @ValidateIf.
      await this.assertPassword(user, dto.currentPassword as string);

      const existing = await this.findByEmail(dto.email);
      if (existing && existing.id !== userId) {
        throw new ConflictException('Email already registered');
      }
      data.email = dto.email;
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
    });
    return this.presentUser(updated);
  }

  async changePassword(
    userId: number,
    dto: ChangePasswordDto,
    ctx: RefreshContext,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.requireUser(userId);
    await this.assertPassword(user, dto.currentPassword);

    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException(
        'New password must be different from the current password.',
      );
    }

    const passwordHash = await hash(dto.newPassword, ARGON2_OPTIONS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Every session is compromised-by-definition once the password that
    // protects it changes — revoke all of them, then open a fresh one for
    // the device that just proved it knows the new password.
    await this.tokens.revokeAllSessionsForUser(userId);
    const accessToken = await this.tokens.issueAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = await this.tokens.issueRefreshSession(user.id, ctx);
    return { accessToken, refreshToken };
  }

  async uploadAvatar(
    userId: number,
    file: Express.Multer.File,
  ): Promise<SafeUser> {
    const user = await this.requireUser(userId);

    let webp: Buffer;
    try {
      // Decode-then-re-encode is the actual security control here, not the
      // client-declared mimetype: it discards every byte of the original
      // file (EXIF/GPS metadata, any polyglot/embedded payload) and emits
      // fresh, known-safe pixel data. A file that isn't a real raster image
      // fails to decode and is rejected outright.
      webp = await sharp(file.buffer)
        .rotate()
        .resize(AVATAR_MAX_DIMENSION, AVATAR_MAX_DIMENSION, { fit: 'cover' })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      throw new BadRequestException('Invalid image file.');
    }

    const key = `avatars/${userId}/${randomUUID()}.webp`;
    await this.storage.put(key, webp, 'image/webp');

    const previousKey = user.avatarStorageKey;
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarStorageKey: key },
    });

    if (previousKey) {
      await this.storage.delete(previousKey).catch(() => undefined);
    }

    return this.presentUser(updated);
  }

  async removeAvatar(userId: number): Promise<SafeUser> {
    const user = await this.requireUser(userId);
    const previousKey = user.avatarStorageKey;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarStorageKey: null },
    });

    if (previousKey) {
      await this.storage.delete(previousKey).catch(() => undefined);
    }

    return this.presentUser(updated);
  }

  async deleteAccount(userId: number, dto: DeleteAccountDto): Promise<void> {
    const user = await this.requireUser(userId);
    await this.assertPassword(user, dto.currentPassword);

    const avatarKey = user.avatarStorageKey;

    await this.tokens.revokeAllSessionsForUser(userId);
    // Cascades (schema.prisma) erase every row owned by this user.
    await this.prisma.user.delete({ where: { id: userId } });

    if (avatarKey) {
      await this.storage.delete(avatarKey).catch(() => undefined);
    }
  }

  async getSettings(userId: number): Promise<UserSettings> {
    return this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async updateSettings(
    userId: number,
    dto: UpdateSettingsDto,
  ): Promise<UserSettings> {
    return this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: { ...dto },
    });
  }

  private async requireUser(userId: number): Promise<User> {
    const user = await this.findById(userId);
    if (!user) throw new ForbiddenException('User no longer exists');
    return user;
  }

  private async assertPassword(user: User, password: string): Promise<void> {
    const valid = await verify(user.passwordHash, password).catch(() => false);
    if (!valid) throw new ForbiddenException('Current password is incorrect.');
  }
}
