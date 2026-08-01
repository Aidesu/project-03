import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TokenService } from './token.service';

/**
 * Split out of AuthModule so both AuthModule and UsersModule can depend on
 * TokenService without importing each other (would otherwise be circular:
 * AuthModule already imports UsersModule for account lookups).
 */
@Module({
  imports: [JwtModule.register({})],
  providers: [TokenService],
  exports: [TokenService],
})
export class TokenModule {}
