import { BadRequestException } from '@nestjs/common';
import { CompaniesService } from '../companies/companies.service';
import { GamificationService } from '../gamification/gamification.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicationsService } from './applications.service';

const OWNER_ID = 1;
const APPLICATION_ID = '11111111-1111-4111-8111-111111111111';
const OWN_COMPANY_ID = '22222222-2222-4222-8222-222222222222';
const FOREIGN_COMPANY_ID = '33333333-3333-4333-8333-333333333333';

describe('ApplicationsService', () => {
  let prisma: {
    jobApplication: { create: jest.Mock; findFirst: jest.Mock };
    company: { count: jest.Mock; findFirst: jest.Mock };
    contact: { count: jest.Mock };
    tag: { count: jest.Mock };
    $transaction: jest.Mock;
  };
  let companies: { create: jest.Mock };
  let service: ApplicationsService;

  beforeEach(() => {
    prisma = {
      jobApplication: {
        create: jest.fn().mockResolvedValue({
          id: APPLICATION_ID,
          status: 'WISHLIST',
        }),
        findFirst: jest.fn(),
      },
      company: { count: jest.fn(), findFirst: jest.fn() },
      contact: { count: jest.fn() },
      tag: { count: jest.fn() },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    companies = { create: jest.fn() };
    service = new ApplicationsService(
      prisma as unknown as PrismaService,
      { award: jest.fn() } as unknown as GamificationService,
      companies as unknown as CompaniesService,
    );
  });

  describe('create', () => {
    // The client now posts `companyId` whenever the user picks from their
    // address book, so this check is what stands between a guessed id and
    // another user's company row.
    it('rejects a companyId owned by another user', async () => {
      prisma.company.count.mockResolvedValue(0);

      await expect(
        service.create(OWNER_ID, {
          position: 'Frontend Developer',
          companyId: FOREIGN_COMPANY_ID,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.company.count).toHaveBeenCalledWith({
        where: { id: FOREIGN_COMPANY_ID, userId: OWNER_ID },
      });
      expect(prisma.jobApplication.create).not.toHaveBeenCalled();
    });

    it('links an owned company without touching the name resolution', async () => {
      prisma.company.count.mockResolvedValue(1);

      await service.create(OWNER_ID, {
        position: 'Frontend Developer',
        companyId: OWN_COMPANY_ID,
        companyName: 'Acme Inc.',
      });

      const { data } = prisma.jobApplication.create.mock.calls[0][0];
      expect(data.userId).toBe(OWNER_ID);
      expect(data.companyId).toBe(OWN_COMPANY_ID);
      // An explicit id wins: no lookup, and above all no duplicate company.
      expect(prisma.company.findFirst).not.toHaveBeenCalled();
      expect(companies.create).not.toHaveBeenCalled();
    });

    it('falls back to resolving a free-text name within the caller scope', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: OWN_COMPANY_ID });

      await service.create(OWNER_ID, {
        position: 'Frontend Developer',
        companyName: 'Acme Inc.',
      });

      expect(prisma.company.findFirst).toHaveBeenCalledWith({
        where: {
          userId: OWNER_ID,
          name: { equals: 'Acme Inc.', mode: 'insensitive' },
        },
        select: { id: true },
      });
      expect(prisma.jobApplication.create.mock.calls[0][0].data.companyId).toBe(
        OWN_COMPANY_ID,
      );
    });

    it('creates the company under the caller when the name is unknown', async () => {
      prisma.company.findFirst.mockResolvedValue(null);
      companies.create.mockResolvedValue({ id: OWN_COMPANY_ID });

      await service.create(OWNER_ID, {
        position: 'Frontend Developer',
        companyName: 'Brand New Co',
      });

      expect(companies.create).toHaveBeenCalledWith(OWNER_ID, {
        name: 'Brand New Co',
      });
    });
  });

  describe('update', () => {
    it('rejects re-linking an owned application to a foreign company', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue({
        id: APPLICATION_ID,
      });
      prisma.company.count.mockResolvedValue(0);

      await expect(
        service.update(OWNER_ID, APPLICATION_ID, {
          companyId: FOREIGN_COMPANY_ID,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
