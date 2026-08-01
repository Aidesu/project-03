import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginated, skipTake } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { QueryDiscoverDto } from './dto/query-discover.dto';

// Explicit allow-list: this app has no global response serializer (see
// main.ts), so field exposure is controlled entirely by what we `select`
// here. Deliberately excludes the `companies` and `reviews` relations —
// never `include` them from this service, that's how Company.notes,
// Contact rows, and review authorship would leak across users.
const DIRECTORY_COMPANY_SAFE_SELECT = {
  id: true,
  name: true,
  website: true,
  industry: true,
  location: true,
  size: true,
  logoUrl: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DirectoryCompanySelect;

type DirectoryCompanySafe = Prisma.DirectoryCompanyGetPayload<{
  select: typeof DIRECTORY_COMPANY_SAFE_SELECT;
}>;

export interface CompanyAggregate {
  avgRating: number | null;
  responseRate: number | null; // 0..1, null when reviewCount is 0
  reviewCount: number;
}

export type DiscoverCompany = DirectoryCompanySafe & {
  aggregate: CompanyAggregate;
};

const EMPTY_AGGREGATE: CompanyAggregate = {
  avgRating: null,
  responseRate: null,
  reviewCount: 0,
};

/**
 * Explicit re-projection, not a spread of the raw Prisma row: defense in
 * depth alongside the `select` allow-list above. Even if a future edit
 * mistakenly widens that `select` (or swaps it for an `include`), this is a
 * second, independent place a leak of `companies`/`reviews` would have to
 * get past, since only these named fields are ever read off `row`.
 */
function toSafeCompany(
  row: DirectoryCompanySafe,
  aggregate: CompanyAggregate,
): DiscoverCompany {
  return {
    id: row.id,
    name: row.name,
    website: row.website,
    industry: row.industry,
    location: row.location,
    size: row.size,
    logoUrl: row.logoUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    aggregate,
  };
}

/**
 * Read path for the community company directory — this app's only
 * cross-user read path. Every method deliberately takes no `userId`: a
 * future edit that tries to sneak in per-user filtering has to change the
 * signature, a visible diff, rather than a silent one-liner. Must never
 * query Company.notes, Contact, or JobApplication.
 */
@Injectable()
export class DiscoverService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(q: QueryDiscoverDto) {
    const where: Prisma.DirectoryCompanyWhereInput = q.search
      ? {
          OR: [
            { name: { contains: q.search, mode: 'insensitive' } },
            { industry: { contains: q.search, mode: 'insensitive' } },
            { location: { contains: q.search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.directoryCompany.findMany({
        where,
        select: DIRECTORY_COMPANY_SAFE_SELECT,
        orderBy: { [q.sortBy]: q.sortOrder },
        ...skipTake(q.page, q.pageSize),
      }),
      this.prisma.directoryCompany.count({ where }),
    ]);

    const aggregates = await this.aggregatesFor(items.map((i) => i.id));
    const withAggregate: DiscoverCompany[] = items.map((item) =>
      toSafeCompany(item, aggregates.get(item.id) ?? EMPTY_AGGREGATE),
    );

    return paginated(withAggregate, total, q.page, q.pageSize);
  }

  async findOne(id: string): Promise<DiscoverCompany> {
    const company = await this.prisma.directoryCompany.findUnique({
      where: { id },
      select: DIRECTORY_COMPANY_SAFE_SELECT,
    });
    if (!company) throw new NotFoundException('Company not found');

    const aggregates = await this.aggregatesFor([id]);
    return toSafeCompany(company, aggregates.get(id) ?? EMPTY_AGGREGATE);
  }

  /** On-the-fly aggregate (avg rating / response rate / count) — no denormalized counters. */
  private async aggregatesFor(
    ids: string[],
  ): Promise<Map<string, CompanyAggregate>> {
    if (ids.length === 0) return new Map();

    // Two independent read-only aggregates — Promise.all (not $transaction:
    // that array form loses Prisma's per-call return-type inference here).
    const [overall, responded] = await Promise.all([
      this.prisma.companyReview.groupBy({
        by: ['directoryCompanyId'],
        where: { directoryCompanyId: { in: ids } },
        orderBy: { directoryCompanyId: 'asc' },
        _avg: { rating: true },
        _count: true,
      }),
      this.prisma.companyReview.groupBy({
        by: ['directoryCompanyId'],
        where: { directoryCompanyId: { in: ids }, didRespond: true },
        orderBy: { directoryCompanyId: 'asc' },
        _count: true,
      }),
    ]);

    const respondedById = new Map(
      responded.map((r) => [r.directoryCompanyId, r._count]),
    );

    return new Map(
      overall.map((row) => {
        const reviewCount = row._count;
        const respondedCount = respondedById.get(row.directoryCompanyId) ?? 0;
        return [
          row.directoryCompanyId,
          {
            avgRating: row._avg.rating,
            reviewCount,
            responseRate: reviewCount > 0 ? respondedCount / reviewCount : null,
          },
        ];
      }),
    );
  }
}
