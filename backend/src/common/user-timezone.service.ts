import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_TIME_ZONE, resolveTimeZone } from './timezone';

/**
 * Resolves the IANA zone every calendar-day computation must run in.
 *
 * Users with no settings row yet (the row is created lazily) fall back to the
 * schema default, so a read path never has to write one just to know what day
 * it is for that user.
 */
@Injectable()
export class UserTimezoneService {
  constructor(private readonly prisma: PrismaService) {}

  async forUser(userId: number): Promise<string> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    if (!settings) return DEFAULT_TIME_ZONE;
    return resolveTimeZone(settings.timezone);
  }
}
