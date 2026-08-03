import { Injectable } from '@nestjs/common';
import {
  ApplicationStatus,
  GamificationProfile,
  Prisma,
  XpReason,
} from '@prisma/client';
import {
  CalendarDay,
  calendarDayFromStored,
  calendarDayIn,
  calendarDayToUtcMidnight,
  calendarDaysBetween,
} from '../common/timezone';
import { UserTimezoneService } from '../common/user-timezone.service';
import { PrismaService } from '../prisma/prisma.service';

// Simple, transparent progression: every 100 XP is one level.
const XP_PER_LEVEL = 100;
const levelForXp = (xp: number): number => Math.floor(xp / XP_PER_LEVEL) + 1;

type AchievementMetric =
  | 'applications'
  | 'interviews'
  | 'offers'
  | 'accepted'
  | 'streak'
  | 'level';

// Maps each catalog code (seeded via prisma/seed.ts) to the metric it tracks.
// Kept in code rather than the schema since Achievement.threshold is a
// generic numeric criterion — this is the only place that gives it meaning.
const ACHIEVEMENT_METRIC: Record<string, AchievementMetric> = {
  FIRST_APPLICATION: 'applications',
  TEN_APPLICATIONS: 'applications',
  TWENTY_FIVE_APPLICATIONS: 'applications',
  FIRST_INTERVIEW: 'interviews',
  FIVE_INTERVIEWS: 'interviews',
  FIRST_OFFER: 'offers',
  OFFER_ACCEPTED: 'accepted',
  STREAK_7: 'streak',
  STREAK_30: 'streak',
  LEVEL_5: 'level',
  LEVEL_10: 'level',
};

/** An unmapped code falls back to the most common metric rather than crashing. */
const metricFor = (code: string): AchievementMetric =>
  ACHIEVEMENT_METRIC[code] ?? 'applications';

/**
 * Idempotency key for an award that may only ever be paid once for a given
 * subject — a milestone on one application, one interview, one achievement.
 *
 * Without it, every reward here is farmable: the status milestones fire on each
 * distinct transition, so APPLIED → INTERVIEW → APPLIED → INTERVIEW loops
 * indefinitely, and an interview toggled PASSED → PENDING → PASSED pays again.
 *
 * `subjectId` is a UUID from whichever table owns the milestone; the reason
 * prefix keeps two different milestones on the same row apart.
 */
export const oncePer = (reason: XpReason, subjectId: string): string =>
  `${reason}:${subjectId}`;

export interface AwardOptions {
  /** Ledger attribution — which application this XP came from, if any. */
  applicationId?: string;
  /** Set for a one-off milestone; leave unset for a repeatable award. */
  dedupeKey?: string;
}

/**
 * Streak arithmetic on calendar days, where `today` is the user's local date —
 * a day boundary is where their clock says it is, not where UTC says it is.
 * `lastActiveOn` stores that date pinned to UTC midnight (see
 * {@link calendarDayToUtcMidnight}), so comparisons stay exact and DST-proof.
 */
function nextStreak(
  existing: GamificationProfile | null,
  today: CalendarDay,
): { current: number; longest: number } {
  const prevLongest = existing?.longestStreakDays ?? 0;
  if (!existing?.lastActiveOn) {
    return { current: 1, longest: Math.max(prevLongest, 1) };
  }
  const last = calendarDayFromStored(existing.lastActiveOn);
  const diffDays = calendarDaysBetween(last, today);
  let current: number;
  if (diffDays <= 0)
    current = Math.max(existing.currentStreakDays, 1); // same day
  else if (diffDays === 1) current = existing.currentStreakDays + 1;
  else current = 1; // streak broken
  return { current, longest: Math.max(prevLongest, current) };
}

@Injectable()
export class GamificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timezones: UserTimezoneService,
  ) {}

  /**
   * Award XP, then re-evaluate the achievement catalog — every XP-earning
   * action is also the moment an achievement can newly unlock.
   */
  async award(
    userId: number,
    reason: XpReason,
    amount: number,
    options: AwardOptions = {},
  ): Promise<void> {
    await this.grantXp(userId, reason, amount, options);
    // Runs even when the award was a duplicate: achievements are evaluated
    // against live counts, so a metric can still have moved (an interview was
    // added) while the XP for that milestone was already paid.
    await this.syncAchievements(userId);
  }

  /**
   * Append to the XP ledger and move the profile forward, creating it lazily on
   * first activity. Returns the resulting XP total, or `null` when the award
   * carried a dedupe key that had already been used.
   *
   * The ledger insert is the gate, not a preliminary check: the unique
   * `(userId, dedupeKey)` index decides, and the insert count tells us whether
   * this call is the one that won. A read-then-write would let two concurrent
   * requests both find nothing and both pay out.
   *
   * The total is incremented by the database, never written as a value this
   * process computed: two awards racing (a status change and an achievement
   * unlock, or two tabs) would otherwise both write `read + amount` and one of
   * them would silently vanish.
   *
   * The streak fields are still read-modify-write, and deliberately so: two
   * awards on the same local day derive the same numbers from the same
   * `lastActiveOn`, so the concurrent case converges instead of losing data.
   */
  private async grantXp(
    userId: number,
    reason: XpReason,
    amount: number,
    options: AwardOptions = {},
  ): Promise<number | null> {
    const timeZone = await this.timezones.forUser(userId);
    const today = calendarDayIn(new Date(), timeZone);
    const lastActiveOn = calendarDayToUtcMidnight(today);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.gamificationProfile.findUnique({
        where: { userId },
      });
      const { current, longest } = nextStreak(existing, today);

      const { count } = await tx.xpEvent.createMany({
        data: {
          userId,
          reason,
          amount,
          applicationId: options.applicationId ?? null,
          dedupeKey: options.dedupeKey ?? null,
        },
        skipDuplicates: true,
      });
      // Replaying a milestone is not activity: it must not extend the streak
      // or refresh `lastActiveOn` either, or a flip-flop would keep a dead
      // streak alive for free.
      if (count === 0) return null;

      const profile = await tx.gamificationProfile.upsert({
        where: { userId },
        create: {
          userId,
          xp: amount,
          level: levelForXp(amount),
          currentStreakDays: 1,
          longestStreakDays: 1,
          lastActiveOn,
        },
        update: {
          xp: { increment: amount },
          currentStreakDays: current,
          longestStreakDays: longest,
          lastActiveOn,
        },
      });

      // `level` is a denormalized cache of levelForXp(xp) — kept current here
      // so the table stays readable on its own, but never trusted on a read
      // path (see getProfile), which derives it from the XP total instead.
      const level = levelForXp(profile.xp);
      if (profile.level !== level) {
        await tx.gamificationProfile.update({
          where: { userId },
          data: { level },
        });
      }

      return profile.xp;
    });
  }

  /**
   * Take back the XP an application earned, as a reversal entry rather than an
   * erasure — the ledger stays append-only and keeps summing to the profile
   * total, which is what makes the total auditable at all.
   *
   * Without this, deleting an application is a free reset: its dedupe keys die
   * with it, so recreating the same application pays every milestone again.
   *
   * Runs in the caller's transaction, and must run *before* the delete:
   * `XpEvent.applicationId` is `SetNull`, so once the row is gone there is
   * nothing left to total up.
   *
   * Returns the amount actually withdrawn.
   */
  async revokeForApplication(
    tx: Prisma.TransactionClient,
    userId: number,
    applicationId: string,
  ): Promise<number> {
    const { _sum } = await tx.xpEvent.aggregate({
      // Scoped by userId as well as the application: an id in a URL proves
      // nothing, and this one reaches straight into someone's XP total.
      where: { userId, applicationId, amount: { gt: 0 } },
      _sum: { amount: true },
    });
    const earned = _sum.amount ?? 0;
    if (earned <= 0) return 0;

    const profile = await tx.gamificationProfile.findUnique({
      where: { userId },
    });
    // Clamped to what the user actually holds: a reversal must never drive the
    // total negative, and clamping the ledger entry itself — rather than the
    // decrement — is what keeps the sum reconciling with the total.
    const amount = Math.min(earned, profile?.xp ?? 0);
    if (amount <= 0) return 0;

    const { count } = await tx.xpEvent.createMany({
      data: {
        userId,
        reason: XpReason.APPLICATION_DELETED,
        amount: -amount,
        // The application is about to disappear and would null this out anyway;
        // the dedupe key is what records which one was reversed.
        applicationId: null,
        dedupeKey: oncePer(XpReason.APPLICATION_DELETED, applicationId),
      },
      skipDuplicates: true,
    });
    if (count === 0) return 0; // a concurrent delete already withdrew it

    const updated = await tx.gamificationProfile.update({
      where: { userId },
      data: { xp: { decrement: amount } },
    });
    const level = levelForXp(updated.xp);
    if (updated.level !== level) {
      await tx.gamificationProfile.update({
        where: { userId },
        data: { level },
      });
    }

    // Achievements are deliberately not re-locked: they are a record of
    // something the user did, and re-locking would let the same one be earned
    // twice. The unlock is one-way, so it cannot be farmed either.
    return amount;
  }

  /** The user's progression summary (+ recent XP), with sane defaults if none yet. */
  async getProfile(userId: number) {
    const [profile, recentXp] = await Promise.all([
      this.prisma.gamificationProfile.findUnique({ where: { userId } }),
      this.prisma.xpEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const xp = profile?.xp ?? 0;
    return {
      xp,
      // Derived, not read from the column: the XP total is the single source
      // of truth, so a stale cached level can never surface to the client.
      level: levelForXp(xp),
      currentStreakDays: profile?.currentStreakDays ?? 0,
      longestStreakDays: profile?.longestStreakDays ?? 0,
      lastActiveOn: profile?.lastActiveOn ?? null,
      xpIntoLevel: xp % XP_PER_LEVEL,
      xpForNextLevel: XP_PER_LEVEL,
      recentXp,
    };
  }

  /** Live values behind each achievement metric — a read, never a write. */
  private async computeMetrics(
    userId: number,
    profile: GamificationProfile | null,
  ): Promise<Record<AchievementMetric, number>> {
    const [applications, interviews, offers, accepted] = await Promise.all([
      this.prisma.jobApplication.count({ where: { userId } }),
      this.prisma.interview.count({ where: { application: { userId } } }),
      this.prisma.jobApplication.count({
        where: {
          userId,
          status: {
            in: [ApplicationStatus.OFFER, ApplicationStatus.ACCEPTED],
          },
        },
      }),
      this.prisma.jobApplication.count({
        where: { userId, status: ApplicationStatus.ACCEPTED },
      }),
    ]);

    return {
      applications,
      interviews,
      offers,
      accepted,
      streak: profile?.longestStreakDays ?? 0,
      level: levelForXp(profile?.xp ?? 0),
    };
  }

  /** The catalog, the user's unlocks and their live metrics — shared by both paths. */
  private async evaluate(userId: number) {
    const [profile, catalog, userRows] = await Promise.all([
      this.prisma.gamificationProfile.findUnique({ where: { userId } }),
      this.prisma.achievement.findMany({ orderBy: { createdAt: 'asc' } }),
      this.prisma.userAchievement.findMany({ where: { userId } }),
    ]);

    return {
      catalog,
      metrics: await this.computeMetrics(userId, profile),
      unlockedById: new Map(userRows.map((row) => [row.achievementId, row])),
    };
  }

  /**
   * Unlock every achievement whose metric has newly crossed its threshold, and
   * grant the XP that comes with it.
   *
   * A write path, called from the mutations that can move a metric — never
   * from a GET. Unlocking on a read made an achievement wait for someone to
   * open the Progression page, and made a request with no CSRF protection
   * grant XP as a side effect.
   */
  async syncAchievements(userId: number): Promise<void> {
    const { catalog, metrics, unlockedById } = await this.evaluate(userId);

    for (const achievement of catalog) {
      if (unlockedById.get(achievement.id)?.unlockedAt) continue;

      const value = metrics[metricFor(achievement.code)];
      const threshold = achievement.threshold ?? 1;
      if (value < threshold) continue;

      // Two syncs can reach the same achievement at once (a status change and
      // an interview saved together, say). The unique (userId, achievementId)
      // constraint is what makes the unlock happen exactly once, and the
      // insert count is what tells us whether *we* are the pass that did it —
      // a check-then-act here would hand out the reward twice.
      const { count } = await this.prisma.userAchievement.createMany({
        data: {
          userId,
          achievementId: achievement.id,
          progress: value,
          unlockedAt: new Date(),
        },
        skipDuplicates: true,
      });
      if (count === 0) continue;

      if (achievement.xpReward > 0) {
        const xp = await this.grantXp(
          userId,
          XpReason.ACHIEVEMENT_UNLOCKED,
          achievement.xpReward,
          {
            dedupeKey: oncePer(XpReason.ACHIEVEMENT_UNLOCKED, achievement.id),
          },
        );
        // The reward can push the user into a new level, and the level is
        // itself a metric — refresh it so a level achievement further down the
        // catalog unlocks in this same pass rather than on the next action.
        if (xp !== null) metrics.level = levelForXp(xp);
      }
    }
  }

  /**
   * The catalog with this user's progress on each entry. Pure read: unlocking
   * is {@link syncAchievements}' job.
   */
  async listAchievements(userId: number) {
    const { catalog, metrics, unlockedById } = await this.evaluate(userId);

    return catalog.map((achievement) => {
      const threshold = achievement.threshold ?? 1;
      const value = metrics[metricFor(achievement.code)];

      return {
        id: achievement.id,
        code: achievement.code,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        xpReward: achievement.xpReward,
        threshold,
        progress: Math.min(value, threshold),
        unlockedAt: unlockedById.get(achievement.id)?.unlockedAt ?? null,
      };
    });
  }
}
