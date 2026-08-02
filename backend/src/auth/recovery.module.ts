import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { AccountRecoveryService } from './account-recovery.service';
import { TokenModule } from './token.module';
import { VerificationTokenService } from './verification-token.service';

/**
 * Password recovery and address verification, in their own module so that
 * UsersModule can trigger a verification mail on an address change without
 * importing AuthModule (which imports UsersModule).
 */
@Module({
  imports: [TokenModule, MailModule],
  providers: [AccountRecoveryService, VerificationTokenService],
  exports: [AccountRecoveryService],
})
export class RecoveryModule {}
