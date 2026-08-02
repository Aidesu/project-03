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
import type { Response } from 'express';
import type { CorrelatedRequest } from '../common/correlation-id.middleware';
import { requestContext } from '../common/request-context';
import { memoryStorage } from 'multer';
import {
  clearAuthCookies,
  setAccessCookie,
  setRefreshCookie,
} from '../auth/cookies';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DataExportService } from './data-export.service';
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
  constructor(
    private readonly users: UsersService,
    private readonly dataExport: DataExportService,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Patch('me')
  async updateAccount(
    @CurrentUser('sub') userId: number,
    @Body() dto: UpdateAccountDto,
    @Req() req: CorrelatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.users.updateAccount(
      userId,
      dto,
      requestContext(req),
    );
    // Present only on an email change, which revoked every session including
    // this one — hand this device a replacement instead of logging it out.
    if (tokens) {
      setAccessCookie(res, tokens.accessToken);
      setRefreshCookie(res, tokens.refreshToken);
    }
    return { user };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('me/password')
  async changePassword(
    @CurrentUser('sub') userId: number,
    @Body() dto: ChangePasswordDto,
    @Req() req: CorrelatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const { accessToken, refreshToken } = await this.users.changePassword(
      userId,
      dto,
      requestContext(req),
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

  /**
   * GDPR access/portability. Rate limited far harder than the rest of the API:
   * it reads every table this account touches, so it is both the most
   * expensive endpoint in the product and the one that copies the most
   * personal data out of it in a single call.
   */
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  @Get('me/export')
  async exportData(
    @CurrentUser('sub') userId: number,
    @Req() req: CorrelatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.dataExport.exportForUser(
      userId,
      requestContext(req),
    );
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="project-03-export-${stamp}.json"`,
    );
    return data;
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
    @Req() req: CorrelatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.users.deleteAccount(userId, dto, requestContext(req));
    clearAuthCookies(res);
  }
}
