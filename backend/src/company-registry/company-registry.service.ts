import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginated, skipTake } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { SearchRegistryDto } from './dto/search-registry.dto';

/**
 * Read-only lookup over the shared company registry. Intentionally has no
 * mutation methods — rows are only ever written by
 * CompanyRegistrySyncService, so the search surface exposed to the app
 * cannot accidentally become a write path.
 */
@Injectable()
export class CompanyRegistryService {
  constructor(private readonly prisma: PrismaService) {}

  async search(q: SearchRegistryDto) {
    const where: Prisma.CompanyRegistryEntryWhereInput = {
      isDiffusible: true,
    };
    if (q.departmentCode) where.departmentCode = q.departmentCode;
    if (q.regionCode) where.regionCode = q.regionCode;
    if (q.q) {
      where.name = { contains: q.q, mode: 'insensitive' };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.companyRegistryEntry.findMany({
        where,
        orderBy: { name: 'asc' },
        ...skipTake(q.page, q.pageSize),
      }),
      this.prisma.companyRegistryEntry.count({ where }),
    ]);

    return paginated(items, total, q.page, q.pageSize);
  }
}
