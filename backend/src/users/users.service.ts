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

/**
 * Mirrors the `UserSettings` column defaults in schema.prisma. Used when a user
 * has no settings row yet, so every auth response can carry a locale without
 * writing a row on a read path.
 */
const DEFAULT_PRESENTATION: UserPresentation = {
  locale: 'fr',
  timezone: 'Europe/Paris',
};

/** The presentation preferences the client needs before it can render anything. */
export interface UserPresentation {
  locale: string;
  timezone: string;
}

/**
 * A user safe to expose over the API. `id` is deliberately the opaque
 * `publicId`, never the sequential primary key — that one stays internal, so
 * a client can neither count accounts nor guess a neighbour's identifier.
 *
 * `locale`/`timezone` are duplicated from UserSettings on purpose: the UI needs
 * the language on the very first paint, and a second round trip to /settings
 * would show a flash of the wrong language on every load.
 */
export type SafeUser = Omit<
  User,
  'id' | 'publicId' | 'passwordHash' | 'avatarStorageKey'
> & {
  id: string;
  avatarUrl: string | null;
} & UserPresentation;

/**
 * Build the client-safe view of a user. Uses an explicit allowlist (not an
 * exclusion) so a future sensitive column can never leak by accident.
 */
export function toSafeUser(
  user: User,
  avatarUrl: string | null = null,
  presentation: UserPresentation = DEFAULT_PRESENTATION,
): SafeUser {
  return {
    id: user.publicId,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    avatarUrl,
    locale: presentation.locale,
    timezone: presentation.timezone,
  };
}

/**
 * Settings as returned to the client: the row's own uuid and the internal
 * `userId` foreign key are both dropped — the caller is the owner by
 * construction, so neither tells them anything they need.
 */
export type SafeUserSettings = Omit<UserSettings, 'id' | 'userId'>;

export function toSafeSettings(settings: UserSettings): SafeUserSettings {
  return {
    locale: settings.locale,
    timezone: settings.timezone,
    weeklyApplicationGoal: settings.weeklyApplicationGoal,
    emailRemindersEnabled: settings.emailRemindersEnabled,
    createdAt: settings.createdAt,
    updatedAt: settings.updatedAt,
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

  /**
   * The single place `SafeUser` views are assembled — resolves the avatar's
   * presigned URL and the user's display preferences. A missing settings row
   * falls back to the schema defaults rather than being created here: this runs
   * on read paths (/auth/me, /auth/refresh) that must not write.
   */
  async presentUser(user: User): Promise<SafeUser> {
    const [avatarUrl, settings] = await Promise.all([
      user.avatarStorageKey
        ? this.storage.presignGet(
            user.avatarStorageKey,
            AVATAR_PRESIGN_TTL_SECONDS,
          )
        : Promise.resolve(null),
      this.prisma.userSettings.findUnique({
        where: { userId: user.id },
        select: { locale: true, timezone: true },
      }),
    ]);
    return toSafeUser(user, avatarUrl, settings ?? DEFAULT_PRESENTATION);
  }

  /**
   * Returns fresh tokens only when the email changed: the recovery address is
   * the root of account takeover, so that change forces every existing session
   * to die and re-opens one for the device that just proved it knows the
   * password — same reasoning as changePassword().
   */
  async updateAccount(
    userId: number,
    dto: UpdateAccountDto,
    ctx: RefreshContext,
  ): Promise<{
    user: SafeUser;
    tokens: { accessToken: string; refreshToken: string } | null;
  }> {
    const user = await this.requireUser(userId);

    const data: { name?: string | null; email?: string } = {};

    if (dto.name !== undefined) {
      data.name = dto.name.length > 0 ? dto.name : null;
    }

    const emailChanged = dto.email !== undefined && dto.email !== user.email;
    if (emailChanged) {
      // currentPassword presence is enforced by UpdateAccountDto's @ValidateIf.
      await this.assertPassword(user, dto.currentPassword as string);

      const existing = await this.findByEmail(dto.email as string);
      if (existing && existing.id !== userId) {
        throw new ConflictException('Email already registered');
      }
      data.email = dto.email;
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    if (!emailChanged) {
      return { user: await this.presentUser(updated), tokens: null };
    }

    await this.tokens.revokeAllSessionsForUser(userId);
    const accessToken = await this.tokens.issueAccessToken({
      sub: updated.id,
      email: updated.email,
      role: updated.role,
    });
    const refreshToken = await this.tokens.issueRefreshSession(updated.id, ctx);
    return {
      user: await this.presentUser(updated),
      tokens: { accessToken, refreshToken },
    };
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

  async getSettings(userId: number): Promise<SafeUserSettings> {
    const settings = await this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    return toSafeSettings(settings);
  }

  async updateSettings(
    userId: number,
    dto: UpdateSettingsDto,
  ): Promise<SafeUserSettings> {
    const settings = await this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: { ...dto },
    });
    return toSafeSettings(settings);
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
