import { XpReason } from '@prisma/client';
import { UserTimezoneService } from '../common/user-timezone.service';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from './gamification.service';

const USER_ID = 1;
const TIME_ZONE = 'Pacific/Auckland'; // UTC+13 in January
const ACHIEVEMENT_ID = '44444444-4444-4444-8444-444444444444';

/** The profile fields `award` reads back when updating the streak. */
const profile = (overrides: {
  lastActiveOn: Date | null;
  currentStreakDays: number;
  longestStreakDays?: number;
}) => ({
  xp: 100,
  level: 2,
  currentStreakDays: overrides.currentStreakDays,
  longestStreakDays: overrides.longestStreakDays ?? overrides.currentStreakDays,
  lastActiveOn: overrides.lastActiveOn,
});

/** One catalog entry, thresholded on the number of applications. */
const catalogEntry = (overrides: Partial<{ xpReward: number }> = {}) => ({
  id: ACHIEVEMENT_ID,
  code: 'FIRST_APPLICATION',
  name: 'First application',
  description: 'Send your first application',
  icon: null,
  xpReward: overrides.xpReward ?? 50,
  threshold: 1,
});

interface PrismaMock {
  gamificationProfile: {
    findUnique: jest.Mock;
    upsert: jest.Mock;
    update: jest.Mock;
  };
  xpEvent: { create: jest.Mock; findMany: jest.Mock };
  achievement: { findMany: jest.Mock };
  userAchievement: { findMany: jest.Mock; createMany: jest.Mock };
  jobApplication: { count: jest.Mock };
  interview: { count: jest.Mock };
  $transaction: jest.Mock;
}

describe('GamificationService', () => {
  let prisma: PrismaMock;
  let service: GamificationService;

  beforeEach(() => {
    prisma = {
      gamificationProfile: {
        findUnique: jest.fn().mockResolvedValue(null),
        // The post-increment row the database hands back.
        upsert: jest.fn().mockResolvedValue({ xp: 120, level: 2 }),
        update: jest.fn(),
      },
      xpEvent: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      achievement: { findMany: jest.fn().mockResolvedValue([]) },
      userAchievement: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      jobApplication: { count: jest.fn().mockResolvedValue(0) },
      interview: { count: jest.fn().mockResolvedValue(0) },
      // Interactive transactions run the callback against the same mock.
      $transaction: jest.fn((arg: unknown) =>
        typeof arg === 'function'
          ? (arg as (tx: PrismaMock) => unknown)(prisma)
          : Promise.all(arg as Promise<unknown>[]),
      ),
    };
    service = new GamificationService(
      prisma as unknown as PrismaService,
      {
        forUser: jest.fn().mockResolvedValue(TIME_ZONE),
      } as unknown as UserTimezoneService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const awardAt = async (iso: string) => {
    jest.useFakeTimers().setSystemTime(new Date(iso));
    await service.award(USER_ID, XpReason.APPLICATION_SUBMITTED, 20);
  };

  const upsertArgs = () =>
    prisma.gamificationProfile.upsert.mock.calls[0][0] as {
      create: { xp: number };
      update: {
        xp: { increment: number };
        currentStreakDays: number;
        longestStreakDays: number;
        lastActiveOn: Date;
      };
    };

  describe('award — XP total', () => {
    it('increments in the database rather than writing a computed total', async () => {
      // Two awards racing would both write `read + amount` and one would be
      // lost; only the database can add them both.
      prisma.gamificationProfile.findUnique.mockResolvedValue(
        profile({ lastActiveOn: null, currentStreakDays: 0 }),
      );

      await awardAt('2026-01-14T22:00:00.000Z');

      expect(upsertArgs().update.xp).toEqual({ increment: 20 });
      expect(upsertArgs().create.xp).toBe(20); // first-ever award: no total yet
    });

    it('refreshes the cached level from the incremented total', async () => {
      prisma.gamificationProfile.upsert.mockResolvedValue({
        xp: 205,
        level: 2,
      });

      await awardAt('2026-01-14T22:00:00.000Z');

      expect(prisma.gamificationProfile.update).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        data: { level: 3 },
      });
    });

    it('leaves the cached level alone when it is already current', async () => {
      await awardAt('2026-01-14T22:00:00.000Z'); // resolves to xp 120, level 2

      expect(prisma.gamificationProfile.update).not.toHaveBeenCalled();
    });

    it('derives the level from the XP total on read', async () => {
      // A stale cached level (0) must never reach the client.
      prisma.gamificationProfile.findUnique.mockResolvedValue({
        xp: 340,
        level: 0,
        currentStreakDays: 2,
        longestStreakDays: 5,
        lastActiveOn: null,
      });

      await expect(service.getProfile(USER_ID)).resolves.toMatchObject({
        xp: 340,
        level: 4,
      });
    });
  });

  describe('award — streak', () => {
    it('stores the activity on the user local day, not the UTC one', async () => {
      // 22:00Z on the 14th is 11:00 on the 15th in Auckland.
      await awardAt('2026-01-14T22:00:00.000Z');

      expect(upsertArgs().update.lastActiveOn).toEqual(
        new Date('2026-01-15T00:00:00.000Z'),
      );
    });

    it('extends the streak on the next local day', async () => {
      prisma.gamificationProfile.findUnique.mockResolvedValue(
        profile({
          lastActiveOn: new Date('2026-01-14T00:00:00.000Z'),
          currentStreakDays: 3,
        }),
      );

      await awardAt('2026-01-14T22:00:00.000Z'); // local 2026-01-15

      expect(upsertArgs().update.currentStreakDays).toBe(4);
      expect(upsertArgs().update.longestStreakDays).toBe(4);
    });

    it('does not double-count two awards inside the same local day', async () => {
      prisma.gamificationProfile.findUnique.mockResolvedValue(
        profile({
          lastActiveOn: new Date('2026-01-15T00:00:00.000Z'),
          currentStreakDays: 4,
        }),
      );

      // 20:00Z and 22:00Z on the 14th are both 2026-01-15 in Auckland — a UTC
      // day boundary sits between them, a local one does not.
      await awardAt('2026-01-14T22:00:00.000Z');

      expect(upsertArgs().update.currentStreakDays).toBe(4);
    });

    it('does not break a streak the user did not actually break', async () => {
      // Yesterday's activity was logged at 09:00 local on the 14th (20:00Z on
      // the 13th). Under UTC bucketing that is two days before "today" in UTC
      // terms, and the streak would reset to 1.
      prisma.gamificationProfile.findUnique.mockResolvedValue(
        profile({
          lastActiveOn: new Date('2026-01-14T00:00:00.000Z'),
          currentStreakDays: 9,
          longestStreakDays: 12,
        }),
      );

      await awardAt('2026-01-14T20:00:00.000Z'); // local 2026-01-15, 09:00

      expect(upsertArgs().update.currentStreakDays).toBe(10);
      expect(upsertArgs().update.longestStreakDays).toBe(12);
    });

    it('resets to 1 after a genuine gap', async () => {
      prisma.gamificationProfile.findUnique.mockResolvedValue(
        profile({
          lastActiveOn: new Date('2026-01-10T00:00:00.000Z'),
          currentStreakDays: 6,
          longestStreakDays: 6,
        }),
      );

      await awardAt('2026-01-14T22:00:00.000Z'); // local 2026-01-15

      expect(upsertArgs().update.currentStreakDays).toBe(1);
      expect(upsertArgs().update.longestStreakDays).toBe(6);
    });
  });

  describe('listAchievements', () => {
    it('never writes, even when a threshold is met', async () => {
      prisma.achievement.findMany.mockResolvedValue([catalogEntry()]);
      prisma.jobApplication.count.mockResolvedValue(3);

      const results = await service.listAchievements(USER_ID);

      expect(prisma.userAchievement.createMany).not.toHaveBeenCalled();
      expect(prisma.xpEvent.create).not.toHaveBeenCalled();
      expect(results).toEqual([
        expect.objectContaining({ progress: 1, unlockedAt: null }),
      ]);
    });

    it('reports an unlock recorded by the write path', async () => {
      const unlockedAt = new Date('2026-01-15T08:00:00.000Z');
      prisma.achievement.findMany.mockResolvedValue([catalogEntry()]);
      prisma.jobApplication.count.mockResolvedValue(1);
      prisma.userAchievement.findMany.mockResolvedValue([
        { achievementId: ACHIEVEMENT_ID, unlockedAt },
      ]);

      await expect(service.listAchievements(USER_ID)).resolves.toEqual([
        expect.objectContaining({ unlockedAt }),
      ]);
    });
  });

  describe('syncAchievements', () => {
    it('unlocks a newly crossed threshold and grants its reward', async () => {
      prisma.achievement.findMany.mockResolvedValue([catalogEntry()]);
      prisma.jobApplication.count.mockResolvedValue(1);

      await service.syncAchievements(USER_ID);

      expect(prisma.userAchievement.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ skipDuplicates: true }),
      );
      expect(prisma.xpEvent.create).toHaveBeenCalledWith({
        data: {
          userId: USER_ID,
          reason: XpReason.ACHIEVEMENT_UNLOCKED,
          amount: 50,
          applicationId: null,
        },
      });
    });

    it('grants nothing when a concurrent pass recorded the unlock first', async () => {
      prisma.achievement.findMany.mockResolvedValue([catalogEntry()]);
      prisma.jobApplication.count.mockResolvedValue(1);
      // The unique (userId, achievementId) constraint absorbed our insert.
      prisma.userAchievement.createMany.mockResolvedValue({ count: 0 });

      await service.syncAchievements(USER_ID);

      expect(prisma.xpEvent.create).not.toHaveBeenCalled();
    });

    it('skips an achievement already unlocked', async () => {
      prisma.achievement.findMany.mockResolvedValue([catalogEntry()]);
      prisma.jobApplication.count.mockResolvedValue(10);
      prisma.userAchievement.findMany.mockResolvedValue([
        {
          achievementId: ACHIEVEMENT_ID,
          unlockedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]);

      await service.syncAchievements(USER_ID);

      expect(prisma.userAchievement.createMany).not.toHaveBeenCalled();
      expect(prisma.xpEvent.create).not.toHaveBeenCalled();
    });

    it('leaves an unmet threshold locked', async () => {
      prisma.achievement.findMany.mockResolvedValue([
        { ...catalogEntry(), threshold: 10 },
      ]);
      prisma.jobApplication.count.mockResolvedValue(2);

      await service.syncAchievements(USER_ID);

      expect(prisma.userAchievement.createMany).not.toHaveBeenCalled();
    });
  });
});
