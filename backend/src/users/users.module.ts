import { Module } from '@nestjs/common';
import { RecoveryModule } from '../auth/recovery.module';
import { TokenModule } from '../auth/token.module';
import { StorageModule } from '../storage/storage.module';
import { DataExportService } from './data-export.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [StorageModule, TokenModule, RecoveryModule],
  controllers: [UsersController],
  providers: [UsersService, DataExportService],
  exports: [UsersService],
})
export class UsersModule {}
