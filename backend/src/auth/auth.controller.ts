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
import { REFRESH_TOKEN_COOKIE } from './auth.constants';
import { AuthService } from './auth.service';
import { clearAuthCookies, setAccessCookie, setRefreshCookie } from './cookies';
import { CsrfService } from './csrf.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { refreshContext } from './refresh-context.util';
import type { AccessTokenPayload } from './token.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly csrf: CsrfService,
    private readonly users: UsersService,
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
}
