import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CompanyRegistryService } from './company-registry.service';
import { SearchRegistryDto } from './dto/search-registry.dto';

@Controller('company-registry')
export class CompanyRegistryController {
  constructor(private readonly registry: CompanyRegistryService) {}

  // Behind the global JwtAuthGuard (no @Public()): any authenticated user of
  // any tenant can search, since this data isn't tenant-owned. Tighter than
  // the global 120/min default tier — this is a DB search endpoint over a
  // potentially large table, not a cheap lookup.
  @Get('search')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  search(@Query() query: SearchRegistryDto) {
    return this.registry.search(query);
  }
}
