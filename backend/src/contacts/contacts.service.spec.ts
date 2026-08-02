import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContactsService } from './contacts.service';
import { QueryContactsDto } from './dto/query-contacts.dto';

const OWNER_ID = 1;
const OTHER_USER_ID = 2;
const CONTACT_ID = '22222222-2222-4222-8222-222222222222';
const FOREIGN_COMPANY_ID = '33333333-3333-4333-8333-333333333333';

function buildQuery(
  overrides: Partial<QueryContactsDto> = {},
): QueryContactsDto {
  return {
    page: 1,
    pageSize: 20,
    sortBy: 'firstName',
    sortOrder: 'asc',
    ...overrides,
  };
}

describe('ContactsService', () => {
  let prisma: {
    $transaction: jest.Mock;
    contact: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    company: { count: jest.Mock };
  };
  let service: ContactsService;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      contact: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      company: { count: jest.fn() },
    };
    service = new ContactsService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('rejects linking a contact to a company owned by another user', async () => {
      // The company exists, but not under this userId — count() returns 0.
      prisma.company.count.mockResolvedValue(0);

      await expect(
        service.create(OWNER_ID, {
          firstName: 'Ada',
          companyId: FOREIGN_COMPANY_ID,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.company.count).toHaveBeenCalledWith({
        where: { id: FOREIGN_COMPANY_ID, userId: OWNER_ID },
      });
      expect(prisma.contact.create).not.toHaveBeenCalled();
    });

    it('stamps the caller as the owner and normalizes missing fields to null', async () => {
      prisma.contact.create.mockResolvedValue({ id: CONTACT_ID });

      await service.create(OWNER_ID, { firstName: 'Ada' });

      expect(prisma.contact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            userId: OWNER_ID,
            firstName: 'Ada',
            lastName: null,
            companyId: null,
            email: null,
            phone: null,
            title: null,
            linkedinUrl: null,
            notes: null,
          },
        }),
      );
    });
  });

  describe('findMany', () => {
    it('always scopes the query to the caller', async () => {
      prisma.contact.findMany.mockResolvedValue([]);
      prisma.contact.count.mockResolvedValue(0);

      await service.findMany(OWNER_ID, buildQuery({ search: 'ada' }));

      expect(prisma.contact.findMany.mock.calls[0][0].where.userId).toBe(
        OWNER_ID,
      );
      expect(prisma.contact.count.mock.calls[0][0].where.userId).toBe(OWNER_ID);
    });

    it('keeps the tenant scope when filtering by company', async () => {
      prisma.contact.findMany.mockResolvedValue([]);
      prisma.contact.count.mockResolvedValue(0);

      await service.findMany(
        OWNER_ID,
        buildQuery({ companyId: FOREIGN_COMPANY_ID }),
      );

      expect(prisma.contact.findMany.mock.calls[0][0].where).toEqual(
        expect.objectContaining({
          userId: OWNER_ID,
          companyId: FOREIGN_COMPANY_ID,
        }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the contact belongs to another user', async () => {
      prisma.contact.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(OTHER_USER_ID, CONTACT_ID),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.contact.findFirst.mock.calls[0][0].where).toEqual({
        id: CONTACT_ID,
        userId: OTHER_USER_ID,
      });
    });
  });

  describe('update', () => {
    it('refuses to update a contact owned by another user', async () => {
      prisma.contact.findFirst.mockResolvedValue(null);

      await expect(
        service.update(OTHER_USER_ID, CONTACT_ID, { firstName: 'Hijacked' }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.contact.update).not.toHaveBeenCalled();
    });

    it('refuses to re-link an owned contact to a foreign company', async () => {
      prisma.contact.findFirst.mockResolvedValue({ id: CONTACT_ID });
      prisma.company.count.mockResolvedValue(0);

      await expect(
        service.update(OWNER_ID, CONTACT_ID, {
          companyId: FOREIGN_COMPANY_ID,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.contact.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('refuses to delete a contact owned by another user', async () => {
      prisma.contact.findFirst.mockResolvedValue(null);

      await expect(
        service.remove(OTHER_USER_ID, CONTACT_ID),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.contact.delete).not.toHaveBeenCalled();
    });

    it('deletes after the ownership check passes', async () => {
      prisma.contact.findFirst.mockResolvedValue({ id: CONTACT_ID });
      prisma.contact.delete.mockResolvedValue({ id: CONTACT_ID });

      await service.remove(OWNER_ID, CONTACT_ID);

      expect(prisma.contact.delete).toHaveBeenCalledWith({
        where: { id: CONTACT_ID },
      });
    });
  });
});
