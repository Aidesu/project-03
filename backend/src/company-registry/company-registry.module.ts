import { Module } from '@nestjs/common';
import { CompanyRegistryController } from './company-registry.controller';
import { CompanyRegistryService } from './company-registry.service';
import { CompanyRegistrySyncService } from './company-registry-sync.service';
import { SireneClientService } from './sirene-client.service';

@Module({
  controllers: [CompanyRegistryController],
  providers: [
    CompanyRegistryService,
    CompanyRegistrySyncService,
    SireneClientService,
  ],
  exports: [CompanyRegistrySyncService],
})
export class CompanyRegistryModule {}
