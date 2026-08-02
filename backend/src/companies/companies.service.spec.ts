import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompaniesService } from './companies.service';
import { QueryCompaniesDto } from './dto/query-companies.dto';

const OWNER_ID = 1;
const OTHER_USER_ID = 2;
const COMPANY_ID = '11111111-1111-4111-8111-111111111111';

function buildQuery(
  overrides: Partial<QueryCompaniesDto> = {},
): QueryCompaniesDto {
  return {
    page: 1,
    pageSize: 20,
    sortBy: 'name',
    sortOrder: 'asc',
    ...overrides,
  };
}

describe('CompaniesService', () => {
  let prisma: {
    $transaction: jest.Mock;
    company: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let service: CompaniesService;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      company: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new CompaniesService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('stamps the caller as the owner and normalizes missing fields to null', async () => {
      prisma.company.create.mockResolvedValue({ id: COMPANY_ID });

      await service.create(OWNER_ID, { name: 'Acme' });

      expect(prisma.company.create).toHaveBeenCalledWith({
        data: {
          userId: OWNER_ID,
          name: 'Acme',
          website: null,
          industry: null,
          location: null,
          size: null,
          logoUrl: null,
          notes: null,
        },
      });
    });
  });

  describe('findMany', () => {
    it('always scopes the query to the caller, search included', async () => {
      prisma.company.findMany.mockResolvedValue([]);
      prisma.company.count.mockResolvedValue(0);

      await service.findMany(OWNER_ID, buildQuery({ search: 'acme' }));

      const args = prisma.company.findMany.mock.calls[0][0];
      expect(args.where.userId).toBe(OWNER_ID);
      expect(args.where.OR).toHaveLength(3);
      expect(prisma.company.count.mock.calls[0][0].where.userId).toBe(OWNER_ID);
    });

    it('returns the standard paginated envelope', async () => {
      prisma.company.findMany.mockResolvedValue([{ id: COMPANY_ID }]);
      prisma.company.count.mockResolvedValue(1);

      const result = await service.findMany(OWNER_ID, buildQuery());

      expect(result).toEqual({
        items: [{ id: COMPANY_ID }],
        total: 1,
        page: 1,
        pageSize: 20,
        pageCount: 1,
      });
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the company belongs to another user', async () => {
      // findFirst is scoped by { id, userId }, so a foreign row simply misses.
      prisma.company.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(OTHER_USER_ID, COMPANY_ID),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.company.findFirst.mock.calls[0][0].where).toEqual({
        id: COMPANY_ID,
        userId: OTHER_USER_ID,
      });
    });

    it('returns the company with its contacts and applications', async () => {
      const row = { id: COMPANY_ID, contacts: [], applications: [] };
      prisma.company.findFirst.mockResolvedValue(row);

      await expect(service.findOne(OWNER_ID, COMPANY_ID)).resolves.toBe(row);
    });
  });

  describe('update', () => {
    it('refuses to update a company owned by another user', async () => {
      prisma.company.findFirst.mockResolvedValue(null);

      await expect(
        service.update(OTHER_USER_ID, COMPANY_ID, { name: 'Hijacked' }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.company.update).not.toHaveBeenCalled();
    });

    it('updates after the ownership check passes', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: COMPANY_ID });
      prisma.company.update.mockResolvedValue({ id: COMPANY_ID });

      await service.update(OWNER_ID, COMPANY_ID, { name: 'Acme SAS' });

      expect(prisma.company.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: COMPANY_ID } }),
      );
    });
  });

  describe('remove', () => {
    it('refuses to delete a company owned by another user', async () => {
      prisma.company.findFirst.mockResolvedValue(null);

      await expect(
        service.remove(OTHER_USER_ID, COMPANY_ID),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.company.delete).not.toHaveBeenCalled();
    });

    it('deletes after the ownership check passes', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: COMPANY_ID });
      prisma.company.delete.mockResolvedValue({ id: COMPANY_ID });

      await service.remove(OWNER_ID, COMPANY_ID);

      expect(prisma.company.delete).toHaveBeenCalledWith({
        where: { id: COMPANY_ID },
      });
    });
  });
});
