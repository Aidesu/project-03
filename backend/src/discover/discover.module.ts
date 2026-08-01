import { Module } from '@nestjs/common';
import { CompanyReviewsService } from './company-reviews.service';
import { DirectoryLinkingService } from './directory-linking.service';
import { DiscoverController } from './discover.controller';
import { DiscoverService } from './discover.service';

@Module({
  controllers: [DiscoverController],
  providers: [DiscoverService, CompanyReviewsService, DirectoryLinkingService],
  exports: [DirectoryLinkingService],
})
export class DiscoverModule {}
