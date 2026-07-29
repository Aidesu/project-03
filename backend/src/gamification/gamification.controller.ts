import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GamificationService } from './gamification.service';

@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamification: GamificationService) {}

  @Get('me')
  me(@CurrentUser('sub') userId: number) {
    return this.gamification.getProfile(userId);
  }

  @Get('achievements')
  achievements(@CurrentUser('sub') userId: number) {
    return this.gamification.listAchievements(userId);
  }
}
