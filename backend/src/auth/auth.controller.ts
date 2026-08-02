import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { UsersService } from '../users/users.service';
import { AccountRecoveryService } from './account-recovery.service';
import { REFRESH_TOKEN_COOKIE } from './auth.constants';
import { AuthService } from './auth.service';
import { clearAuthCookies, setAccessCookie, setRefreshCookie } from './cookies';
import { CsrfService } from './csrf.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/password-reset.dto';
import { RegisterDto } from './dto/register.dto';
import { refreshContext } from './refresh-context.util';
import type { AccessTokenPayload } from './token.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly csrf: CsrfService,
    private readonly users: UsersService,
    private readonly recovery: AccountRecoveryService,
  ) {}

  /** Bootstrap CSRF: sets the XSRF-TOKEN cookie the SPA echoes back as a header. */
  @Public()
  @Get('csrf')
  @HttpCode(HttpStatus.NO_CONTENT)
  issueCsrf(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): void {
    this.csrf.issueToken(req, res);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.register(dto, refreshContext(req));
    setAccessCookie(res, result.accessToken);
    setRefreshCookie(res, result.refreshToken);
    return { user: await this.users.presentUser(result.user) };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto, refreshContext(req));
    setAccessCookie(res, result.accessToken);
    setRefreshCookie(res, result.refreshToken);
    return { user: await this.users.presentUser(result.user) };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    if (!raw) {
      clearAuthCookies(res);
      throw new UnauthorizedException('Missing refresh token');
    }
    try {
      const result = await this.auth.refresh(raw, refreshContext(req));
      setAccessCookie(res, result.accessToken);
      setRefreshCookie(res, result.refreshToken);
      return { user: await this.users.presentUser(result.user) };
    } catch (err) {
      clearAuthCookies(res);
      throw err;
    }
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(
      req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined,
    );
    clearAuthCookies(res);
  }

  @Get('me')
  async me(@CurrentUser() user: AccessTokenPayload) {
    return { user: await this.auth.getProfile(user.sub) };
  }

  /**
   * Always 204, whether or not the address has an account: the response is the
   * one place this endpoint could be turned into an account oracle.
   */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('password/forgot')
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.recovery.requestPasswordReset(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('password/reset')
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.recovery.resetPassword(dto.token, dto.password);
    // Every session was just revoked, including this browser's if it had one:
    // clear the cookies rather than leave it holding a dead access token.
    clearAuthCookies(res);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('email/verify')
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<void> {
    await this.recovery.verifyEmail(dto.token);
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('email/verify/resend')
  async resendVerification(
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<void> {
    await this.recovery.sendEmailVerification({
      id: user.sub,
      email: user.email,
    });
  }
}
