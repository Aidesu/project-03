import { PrismaService } from '../prisma/prisma.service';
import { CompanyRegistryService } from './company-registry.service';
import { SearchRegistryDto } from './dto/search-registry.dto';

function buildQuery(
  overrides: Partial<SearchRegistryDto> = {},
): SearchRegistryDto {
  return {
    page: 1,
    pageSize: 20,
    sortOrder: 'desc',
    ...overrides,
  };
}

describe('CompanyRegistryService', () => {
  let prisma: {
    $transaction: jest.Mock;
    companyRegistryEntry: { findMany: jest.Mock; count: jest.Mock };
  };
  let service: CompanyRegistryService;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      companyRegistryEntry: { findMany: jest.fn(), count: jest.fn() },
    };
    service = new CompanyRegistryService(prisma as unknown as PrismaService);
  });

  it('always excludes non-diffusible rows, even with no filters', async () => {
    prisma.companyRegistryEntry.findMany.mockResolvedValue([]);
    prisma.companyRegistryEntry.count.mockResolvedValue(0);

    await service.search(buildQuery());

    expect(prisma.companyRegistryEntry.findMany.mock.calls[0][0].where).toEqual(
      { isDiffusible: true },
    );
    expect(prisma.companyRegistryEntry.count.mock.calls[0][0].where).toEqual({
      isDiffusible: true,
    });
  });

  it('applies department, region, and name filters together', async () => {
    prisma.companyRegistryEntry.findMany.mockResolvedValue([]);
    prisma.companyRegistryEntry.count.mockResolvedValue(0);

    await service.search(
      buildQuery({ departmentCode: '75', regionCode: '11', q: 'acme' }),
    );

    const where = prisma.companyRegistryEntry.findMany.mock.calls[0][0].where;
    expect(where).toEqual({
      isDiffusible: true,
      departmentCode: '75',
      regionCode: '11',
      name: { contains: 'acme', mode: 'insensitive' },
    });
  });

  it('returns the standard paginated envelope', async () => {
    prisma.companyRegistryEntry.findMany.mockResolvedValue([{ siret: '1' }]);
    prisma.companyRegistryEntry.count.mockResolvedValue(1);

    const result = await service.search(buildQuery());

    expect(result).toEqual({
      items: [{ siret: '1' }],
      total: 1,
      page: 1,
      pageSize: 20,
      pageCount: 1,
    });
  });
});
