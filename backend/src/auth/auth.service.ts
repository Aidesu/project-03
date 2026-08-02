import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { AuditAction, User } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../common/request-context';
import { SafeUser, UsersService } from '../users/users.service';
import { AccountRecoveryService } from './account-recovery.service';
import { ARGON2_OPTIONS } from './password.util';
import { RefreshTokenError, TokenService } from './token.service';

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  // Lazily-computed dummy hash, used to equalize login timing for unknown users.
  private dummyHash?: string;

  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly recovery: AccountRecoveryService,
    private readonly audit: AuditService,
  ) {}

  async register(
    input: { email: string; password: string; name?: string; locale?: string },
    ctx: RequestContext,
  ): Promise<AuthResult> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      // Recorded, not just rejected: a run of these is someone probing which
      // addresses already have an account.
      await this.audit.failure(AuditAction.USER_REGISTERED, {
        context: ctx,
        metadata: { reason: 'email_taken' },
      });
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await hash(input.password, ARGON2_OPTIONS);
    const user = await this.users.create({
      email: input.email,
      passwordHash,
      name: input.name ?? null,
    });
    // Not awaited for its result, and never a reason to fail the signup: the
    // account works unverified, the link can always be re-sent.
    await this.recovery.sendEmailVerification(user, {
      locale: input.locale,
      context: ctx,
    });
    await this.audit.success(AuditAction.USER_REGISTERED, {
      userId: user.id,
      context: ctx,
    });
    return this.issueFor(user, ctx);
  }

  async login(
    input: { email: string; password: string },
    ctx: RequestContext,
  ): Promise<AuthResult> {
    const user = await this.users.findByEmail(input.email);
    if (!user) {
      // Run a verify against a dummy hash so timing doesn't reveal user existence.
      await this.dummyVerify(input.password);
      // No user id and no address on the entry — the trail records that an
      // unknown account was tried from this IP, not which address it was.
      await this.audit.failure(AuditAction.USER_LOGIN, {
        context: ctx,
        metadata: { reason: 'unknown_account' },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await verify(user.passwordHash, input.password).catch(
      () => false,
    );
    if (!valid) {
      await this.audit.failure(AuditAction.USER_LOGIN, {
        userId: user.id,
        context: ctx,
        metadata: { reason: 'invalid_password' },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.audit.success(AuditAction.USER_LOGIN, {
      userId: user.id,
      context: ctx,
    });
    return this.issueFor(user, ctx);
  }

  /**
   * Successful rotations are deliberately not audited: one entry every 15
   * minutes per active device would bury the events that matter under noise,
   * and the session row already carries the same facts. The failure that does
   * matter — a replayed token — is recorded in TokenService.
   */
  async refresh(rawToken: string, ctx: RequestContext): Promise<AuthResult> {
    let rotated: { token: string; userId: number };
    try {
      rotated = await this.tokens.rotateRefreshSession(rawToken, ctx);
    } catch (err) {
      if (err instanceof RefreshTokenError) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      throw err;
    }

    const user = await this.users.findById(rotated.userId);
    if (!user) throw new UnauthorizedException('Invalid refresh token');

    const accessToken = await this.tokens.issueAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return { user, accessToken, refreshToken: rotated.token };
  }

  async logout(
    rawToken: string | undefined,
    userId: number,
    ctx: RequestContext,
  ): Promise<void> {
    if (rawToken) await this.tokens.revokeRefreshToken(rawToken);
    await this.audit.success(AuditAction.USER_LOGOUT, {
      userId,
      context: ctx,
    });
  }

  async getProfile(userId: number): Promise<SafeUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('User no longer exists');
    return this.users.presentUser(user);
  }

  private async issueFor(user: User, ctx: RequestContext): Promise<AuthResult> {
    const accessToken = await this.tokens.issueAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = await this.tokens.issueRefreshSession(user.id, ctx);
    return { user, accessToken, refreshToken };
  }

  private async dummyVerify(password: string): Promise<void> {
    if (!this.dummyHash) {
      this.dummyHash = await hash(
        'timing-equalization-placeholder',
        ARGON2_OPTIONS,
      );
    }
    await verify(this.dummyHash, password).catch(() => undefined);
  }
}
