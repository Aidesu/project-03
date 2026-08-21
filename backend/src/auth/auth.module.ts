import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CsrfService } from './csrf.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RecoveryModule } from './recovery.module';
import { SessionRetentionService } from './session-retention.service';
import { SessionsService } from './sessions.service';
import { TokenModule } from './token.module';

@Module({
  imports: [UsersModule, TokenModule, RecoveryModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    CsrfService,
    SessionsService,
    // Cron only — nothing injects it, but it must be instantiated to register.
    SessionRetentionService,
    // Secure-by-default: applied globally; opt out per route with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [CsrfService],
})
export class AuthModule {}
