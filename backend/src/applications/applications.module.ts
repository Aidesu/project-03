import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { CompaniesModule } from '../companies/companies.module';
import { GamificationModule } from '../gamification/gamification.module';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

@Module({
  imports: [CommonModule, GamificationModule, CompaniesModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}
