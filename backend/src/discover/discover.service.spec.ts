import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DiscoverService } from './discover.service';
import { QueryDiscoverDto } from './dto/query-discover.dto';

function buildQuery(overrides: Partial<QueryDiscoverDto> = {}): QueryDiscoverDto {
  return {
    page: 1,
    pageSize: 20,
    sortOrder: 'asc',
    sortBy: 'name',
    ...overrides,
  } as QueryDiscoverDto;
}

const SAFE_COMPANY_ROW = {
  id: 'dc-1',
  name: 'Acme',
  website: 'acme.com',
  industry: 'Tech',
  location: 'Paris',
  size: '11-50',
  logoUrl: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('DiscoverService', () => {
  let prisma: {
    $transaction: jest.Mock;
    directoryCompany: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock };
    companyReview: { groupBy: jest.Mock };
  };
  let service: DiscoverService;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      directoryCompany: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
      companyReview: { groupBy: jest.fn() },
    };
    service = new DiscoverService(prisma as unknown as PrismaService);
  });

  describe('findOne', () => {
    it('throws NotFoundException when the company does not exist', async () => {
      prisma.directoryCompany.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('selects only the safe field subset — never the private companies/reviews relations', async () => {
      prisma.directoryCompany.findUnique.mockResolvedValue(SAFE_COMPANY_ROW);
      prisma.companyReview.groupBy.mockResolvedValue([]);

      await service.findOne('dc-1');

      const call = prisma.directoryCompany.findUnique.mock.calls[0][0];
      expect(call.select).not.toHaveProperty('companies');
      expect(call.select).not.toHaveProperty('reviews');
      expect(call.select).toEqual({
        id: true,
        name: true,
        website: true,
        industry: true,
        location: true,
        size: true,
        logoUrl: true,
        createdAt: true,
        updatedAt: true,
      });
    });

    it('never leaks private data even if the Prisma call were to return extra fields', async () => {
      // Adversarial: simulates what a careless future `include` would hand back.
      // The service must not pass this through — see toSafeCompany() in discover.service.ts.
      prisma.directoryCompany.findUnique.mockResolvedValue({
        ...SAFE_COMPANY_ROW,
        companies: [{ id: 'c-1', userId: 42, notes: 'SECRET private note' }],
        reviews: [{ id: 'r-1', userId: 99, rating: 5, didRespond: true }],
      });
      prisma.companyReview.groupBy.mockResolvedValue([]);

      const result = await service.findOne('dc-1');

      expect(result).not.toHaveProperty('companies');
      expect(result).not.toHaveProperty('reviews');
      expect(JSON.stringify(result)).not.toContain('SECRET private note');
    });

    it('computes avgRating/reviewCount/responseRate from the grouped aggregates', async () => {
      prisma.directoryCompany.findUnique.mockResolvedValue(SAFE_COMPANY_ROW);
      prisma.companyReview.groupBy
        .mockResolvedValueOnce([{ directoryCompanyId: 'dc-1', _avg: { rating: 4.5 }, _count: 4 }])
        .mockResolvedValueOnce([{ directoryCompanyId: 'dc-1', _count: 3 }]);

      const result = await service.findOne('dc-1');

      expect(result.aggregate).toEqual({ avgRating: 4.5, reviewCount: 4, responseRate: 0.75 });
    });

    it('returns a null-ish empty aggregate when there are no reviews yet', async () => {
      prisma.directoryCompany.findUnique.mockResolvedValue(SAFE_COMPANY_ROW);
      prisma.companyReview.groupBy.mockResolvedValue([]);

      const result = await service.findOne('dc-1');

      expect(result.aggregate).toEqual({ avgRating: null, reviewCount: 0, responseRate: null });
    });
  });

  describe('findMany', () => {
    it('builds a case-insensitive OR search across name/industry/location, with the same safe select', async () => {
      prisma.directoryCompany.findMany.mockResolvedValue([]);
      prisma.directoryCompany.count.mockResolvedValue(0);

      await service.findMany(buildQuery({ search: 'doct' }));

      const call = prisma.directoryCompany.findMany.mock.calls[0][0];
      expect(call.where).toEqual({
        OR: [
          { name: { contains: 'doct', mode: 'insensitive' } },
          { industry: { contains: 'doct', mode: 'insensitive' } },
          { location: { contains: 'doct', mode: 'insensitive' } },
        ],
      });
      expect(call.select).not.toHaveProperty('companies');
      expect(call.select).not.toHaveProperty('reviews');
    });

    it('returns a paginated envelope with per-item aggregates attached', async () => {
      prisma.directoryCompany.findMany.mockResolvedValue([SAFE_COMPANY_ROW]);
      prisma.directoryCompany.count.mockResolvedValue(1);
      prisma.companyReview.groupBy.mockResolvedValue([]);

      const result = await service.findMany(buildQuery());

      expect(result.total).toBe(1);
      expect(result.items[0].id).toBe('dc-1');
      expect(result.items[0].aggregate).toEqual({
        avgRating: null,
        reviewCount: 0,
        responseRate: null,
      });
    });
  });
});
