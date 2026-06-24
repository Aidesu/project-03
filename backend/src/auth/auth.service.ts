import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { User } from '@prisma/client';
import { SafeUser, toSafeUser, UsersService } from '../users/users.service';
import {
  RefreshContext,
  RefreshTokenError,
  TokenService,
} from './token.service';

// @node-rs/argon2 defaults to Argon2id. OWASP-recommended cost (~19 MiB, 2 iterations).
const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

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
  ) {}

  async register(
    input: { email: string; password: string; name?: string },
    ctx: RefreshContext,
  ): Promise<AuthResult> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await hash(input.password, ARGON2_OPTIONS);
    const user = await this.users.create({
      email: input.email,
      passwordHash,
      name: input.name ?? null,
    });
    return this.issueFor(user, ctx);
  }

  async login(
    input: { email: string; password: string },
    ctx: RefreshContext,
  ): Promise<AuthResult> {
    const user = await this.users.findByEmail(input.email);
    if (!user) {
      // Run a verify against a dummy hash so timing doesn't reveal user existence.
      await this.dummyVerify(input.password);
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await verify(user.passwordHash, input.password).catch(
      () => false,
    );
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    return this.issueFor(user, ctx);
  }

  async refresh(rawToken: string, ctx: RefreshContext): Promise<AuthResult> {
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

  async logout(rawToken: string | undefined): Promise<void> {
    if (rawToken) await this.tokens.revokeRefreshToken(rawToken);
  }

  async getProfile(userId: number): Promise<SafeUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('User no longer exists');
    return toSafeUser(user);
  }

  private async issueFor(user: User, ctx: RefreshContext): Promise<AuthResult> {
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
