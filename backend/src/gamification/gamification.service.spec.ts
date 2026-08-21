import { Prisma, XpReason } from '@prisma/client';
import { UserTimezoneService } from '../common/user-timezone.service';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from './gamification.service';

const USER_ID = 1;
const TIME_ZONE = 'Pacific/Auckland'; // UTC+13 in January
const ACHIEVEMENT_ID = '44444444-4444-4444-8444-444444444444';
const APPLICATION_ID = '55555555-5555-4555-8555-555555555555';
const KEY = `${XpReason.INTERVIEW_SCHEDULED}:${APPLICATION_ID}`;

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
  xpEvent: { createMany: jest.Mock; findMany: jest.Mock; aggregate: jest.Mock };
  achievement: { findMany: jest.Mock };
  userAchievement: { findMany: jest.Mock; createMany: jest.Mock };
  jobApplication: { count: jest.Mock };
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
      xpEvent: {
        // Default: the ledger row was ours to insert, i.e. no dedupe hit.
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
      achievement: { findMany: jest.fn().mockResolvedValue([]) },
      userAchievement: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      jobApplication: { count: jest.fn().mockResolvedValue(0) },
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

  describe('award — dedupe key', () => {
    const awardMilestone = async (dedupeKey?: string) => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-14T22:00:00.000Z'));
      await service.award(USER_ID, XpReason.INTERVIEW_SCHEDULED, 30, {
        applicationId: APPLICATION_ID,
        dedupeKey,
      });
    };

    it('carries the key into the ledger insert, which absorbs the duplicate', async () => {
      // The unique index is the gate: a check-then-act would let two
      // concurrent transitions both find nothing and both pay out.
      await awardMilestone(KEY);

      expect(prisma.xpEvent.createMany).toHaveBeenCalledWith({
        data: {
          userId: USER_ID,
          reason: XpReason.INTERVIEW_SCHEDULED,
          amount: 30,
          applicationId: APPLICATION_ID,
          dedupeKey: KEY,
        },
        skipDuplicates: true,
      });
    });

    it('credits nothing when the milestone was already paid', async () => {
      // What an APPLIED → INTERVIEW → APPLIED → INTERVIEW loop now hits.
      prisma.xpEvent.createMany.mockResolvedValue({ count: 0 });

      await awardMilestone(KEY);

      expect(prisma.gamificationProfile.upsert).not.toHaveBeenCalled();
      expect(prisma.gamificationProfile.update).not.toHaveBeenCalled();
    });

    it('does not let a replayed milestone keep a dead streak alive', async () => {
      prisma.gamificationProfile.findUnique.mockResolvedValue(
        profile({
          lastActiveOn: new Date('2026-01-10T00:00:00.000Z'),
          currentStreakDays: 6,
        }),
      );
      prisma.xpEvent.createMany.mockResolvedValue({ count: 0 });

      await awardMilestone(KEY);

      expect(prisma.gamificationProfile.upsert).not.toHaveBeenCalled();
    });

    it('still re-evaluates achievements after a duplicate', async () => {
      // The XP was already paid, but the metric behind an achievement can have
      // moved since — the unlock must not wait for the next fresh award.
      prisma.xpEvent.createMany.mockResolvedValue({ count: 0 });
      prisma.achievement.findMany.mockResolvedValue([
        { ...catalogEntry(), xpReward: 0 },
      ]);
      prisma.jobApplication.count.mockResolvedValue(1);

      await awardMilestone(KEY);

      expect(prisma.userAchievement.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ skipDuplicates: true }),
      );
    });

    it('leaves a repeatable award unkeyed, so it never collides', async () => {
      // NULLs do not collide in a Postgres unique index — that is what keeps
      // the non-milestone awards repeatable.
      await awardMilestone(undefined);

      expect(prisma.xpEvent.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ dedupeKey: null }),
        }),
      );
      expect(prisma.gamificationProfile.upsert).toHaveBeenCalled();
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

  describe('revokeForApplication', () => {
    const REVERSAL_KEY = `${XpReason.APPLICATION_DELETED}:${APPLICATION_ID}`;

    /**
     * The application earned `earned` XP and the user currently holds `held`.
     * `cachedLevel` is what the post-decrement row still carries, so a test can
     * choose whether the level cache comes back stale.
     */
    const holding = (earned: number, held: number, cachedLevel = 2) => {
      prisma.xpEvent.aggregate.mockResolvedValue({ _sum: { amount: earned } });
      prisma.gamificationProfile.findUnique.mockResolvedValue({ xp: held });
      prisma.gamificationProfile.update.mockResolvedValue({
        xp: held - Math.min(earned, held),
        level: cachedLevel,
      });
    };

    const revoke = () =>
      service.revokeForApplication(
        prisma as unknown as Prisma.TransactionClient,
        USER_ID,
        APPLICATION_ID,
      );

    it('writes a negative reversal instead of erasing the ledger rows', async () => {
      // The ledger has to keep summing to the profile total — that is the whole
      // reason the total is recomputable.
      holding(60, 200);

      await expect(revoke()).resolves.toBe(60);

      expect(prisma.xpEvent.createMany).toHaveBeenCalledWith({
        data: {
          userId: USER_ID,
          reason: XpReason.APPLICATION_DELETED,
          amount: -60,
          applicationId: null,
          dedupeKey: REVERSAL_KEY,
        },
        skipDuplicates: true,
      });
      expect(prisma.gamificationProfile.update).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        data: { xp: { decrement: 60 } },
      });
    });

    it('totals only that application, scoped to the caller', async () => {
      holding(60, 200);

      await revoke();

      expect(prisma.xpEvent.aggregate).toHaveBeenCalledWith({
        where: {
          userId: USER_ID,
          applicationId: APPLICATION_ID,
          amount: { gt: 0 },
        },
        _sum: { amount: true },
      });
    });

    it('never drives the total below zero', async () => {
      // Earned 60, but an earlier reversal already took the total down to 25.
      holding(60, 25);

      await expect(revoke()).resolves.toBe(25);

      expect(prisma.xpEvent.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: -25 }),
        }),
      );
    });

    it('drops the level when the withdrawal crosses a boundary', async () => {
      // 220 - 60 = 160, which is level 2 — but the cached column still says 3.
      holding(60, 220, 3);

      await revoke();

      expect(prisma.gamificationProfile.update).toHaveBeenLastCalledWith({
        where: { userId: USER_ID },
        data: { level: 2 },
      });
    });

    it('withdraws nothing when the application never earned any', async () => {
      holding(0, 200);

      await expect(revoke()).resolves.toBe(0);

      expect(prisma.xpEvent.createMany).not.toHaveBeenCalled();
      expect(prisma.gamificationProfile.update).not.toHaveBeenCalled();
    });

    it('withdraws once when two deletes race', async () => {
      holding(60, 200);
      // The unique (userId, dedupeKey) index absorbed the second reversal.
      prisma.xpEvent.createMany.mockResolvedValue({ count: 0 });

      await expect(revoke()).resolves.toBe(0);

      expect(prisma.gamificationProfile.update).not.toHaveBeenCalled();
    });

    it('leaves unlocked achievements alone', async () => {
      // Re-locking would let the same achievement be earned a second time.
      holding(60, 200);

      await revoke();

      expect(prisma.userAchievement.createMany).not.toHaveBeenCalled();
    });
  });

  describe('listAchievements', () => {
    it('never writes, even when a threshold is met', async () => {
      prisma.achievement.findMany.mockResolvedValue([catalogEntry()]);
      prisma.jobApplication.count.mockResolvedValue(3);

      const results = await service.listAchievements(USER_ID);

      expect(prisma.userAchievement.createMany).not.toHaveBeenCalled();
      expect(prisma.xpEvent.createMany).not.toHaveBeenCalled();
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
      expect(prisma.xpEvent.createMany).toHaveBeenCalledWith({
        data: {
          userId: USER_ID,
          reason: XpReason.ACHIEVEMENT_UNLOCKED,
          amount: 50,
          applicationId: null,
          dedupeKey: `${XpReason.ACHIEVEMENT_UNLOCKED}:${ACHIEVEMENT_ID}`,
        },
        skipDuplicates: true,
      });
    });

    it('grants nothing when a concurrent pass recorded the unlock first', async () => {
      prisma.achievement.findMany.mockResolvedValue([catalogEntry()]);
      prisma.jobApplication.count.mockResolvedValue(1);
      // The unique (userId, achievementId) constraint absorbed our insert.
      prisma.userAchievement.createMany.mockResolvedValue({ count: 0 });

      await service.syncAchievements(USER_ID);

      expect(prisma.xpEvent.createMany).not.toHaveBeenCalled();
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
      expect(prisma.xpEvent.createMany).not.toHaveBeenCalled();
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
