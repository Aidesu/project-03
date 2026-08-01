import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Put,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import {
  clearAuthCookies,
  setAccessCookie,
  setRefreshCookie,
} from '../auth/cookies';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { refreshContext } from '../auth/refresh-context.util';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UsersService } from './users.service';

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_MIME_ALLOWLIST = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
// The mimetype filter below is a fast, cheap rejection for obviously-wrong
// uploads — it is NOT the security boundary. UsersService.uploadAvatar
// decodes and re-encodes the actual bytes with sharp, which is what
// actually defends against a mislabelled or polyglot file.
const avatarInterceptor = FileInterceptor('avatar', {
  storage: memoryStorage(),
  limits: { fileSize: AVATAR_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    cb(null, AVATAR_MIME_ALLOWLIST.has(file.mimetype));
  },
});

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Patch('me')
  async updateAccount(
    @CurrentUser('sub') userId: number,
    @Body() dto: UpdateAccountDto,
  ) {
    return { user: await this.users.updateAccount(userId, dto) };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('me/password')
  async changePassword(
    @CurrentUser('sub') userId: number,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const { accessToken, refreshToken } = await this.users.changePassword(
      userId,
      dto,
      refreshContext(req),
    );
    setAccessCookie(res, accessToken);
    setRefreshCookie(res, refreshToken);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('me/avatar')
  @UseInterceptors(avatarInterceptor)
  async uploadAvatar(
    @CurrentUser('sub') userId: number,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded.');
    return { user: await this.users.uploadAvatar(userId, file) };
  }

  @Delete('me/avatar')
  async removeAvatar(@CurrentUser('sub') userId: number) {
    return { user: await this.users.removeAvatar(userId) };
  }

  @Get('me/settings')
  getSettings(@CurrentUser('sub') userId: number) {
    return this.users.getSettings(userId);
  }

  @Put('me/settings')
  updateSettings(
    @CurrentUser('sub') userId: number,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.users.updateSettings(userId, dto);
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('me/delete')
  async deleteAccount(
    @CurrentUser('sub') userId: number,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.users.deleteAccount(userId, dto);
    clearAuthCookies(res);
  }
}
