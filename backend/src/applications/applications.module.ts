import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module';
import { GamificationModule } from '../gamification/gamification.module';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

@Module({
  imports: [GamificationModule, CompaniesModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}
