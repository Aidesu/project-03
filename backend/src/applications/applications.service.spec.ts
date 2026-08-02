import { BadRequestException } from '@nestjs/common';
import { UserTimezoneService } from '../common/user-timezone.service';
import { CompaniesService } from '../companies/companies.service';
import { GamificationService } from '../gamification/gamification.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicationsService } from './applications.service';

const OWNER_ID = 1;
// UTC+13 in January: any UTC-based bucketing is visibly off by a day here.
const TIME_ZONE = 'Pacific/Auckland';
const APPLICATION_ID = '11111111-1111-4111-8111-111111111111';
const OWN_COMPANY_ID = '22222222-2222-4222-8222-222222222222';
const FOREIGN_COMPANY_ID = '33333333-3333-4333-8333-333333333333';

describe('ApplicationsService', () => {
  let prisma: {
    jobApplication: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
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
        findMany: jest.fn(),
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
      {
        forUser: jest.fn().mockResolvedValue(TIME_ZONE),
      } as unknown as UserTimezoneService,
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

  describe('dailyStats', () => {
    // 2026-01-14T22:00:00Z is already 2026-01-15, 11:00 in Auckland.
    const NOW = new Date('2026-01-14T22:00:00.000Z');

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(NOW);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('buckets on the caller local days, not UTC days', async () => {
      prisma.jobApplication.findMany.mockResolvedValue([
        // 09:00 in Auckland on the 15th — UTC still says the 14th.
        { createdAt: new Date('2026-01-14T20:00:00.000Z') },
        // 23:30 in Auckland on the 14th — UTC says the 14th too, but local
        // midnight has not passed yet, so this one belongs to the day before.
        { createdAt: new Date('2026-01-14T10:30:00.000Z') },
      ]);

      const stats = await service.dailyStats(OWNER_ID, { days: 3 });

      expect(stats).toEqual([
        { date: '2026-01-13', count: 0 },
        { date: '2026-01-14', count: 1 },
        { date: '2026-01-15', count: 1 },
      ]);
    });

    it('queries from an instant at or before the local start of the window', async () => {
      prisma.jobApplication.findMany.mockResolvedValue([]);

      await service.dailyStats(OWNER_ID, { days: 3 });

      const { where } = prisma.jobApplication.findMany.mock.calls[0][0];
      expect(where.userId).toBe(OWNER_ID);
      // 2026-01-13 00:00 in Auckland (UTC+13) is 2026-01-12T11:00Z.
      expect(where.createdAt.gte.getTime()).toBeLessThanOrEqual(
        new Date('2026-01-12T11:00:00.000Z').getTime(),
      );
    });

    it('drops rows that the over-inclusive lower bound pulled in', async () => {
      prisma.jobApplication.findMany.mockResolvedValue([
        // 2026-01-12, 23:00 in Auckland: fetched by the range query, but a day
        // older than the requested window.
        { createdAt: new Date('2026-01-12T10:00:00.000Z') },
      ]);

      const stats = await service.dailyStats(OWNER_ID, { days: 3 });

      expect(stats.every((s) => s.count === 0)).toBe(true);
      expect(stats).toHaveLength(3);
    });
  });
});
