import { Injectable } from '@nestjs/common';
import {
  ApplicationStatus,
  GamificationProfile,
  XpReason,
} from '@prisma/client';
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

/** UTC midnight of the given date, used for day-granular streak comparisons. */
function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function nextStreak(
  existing: GamificationProfile | null,
  today: Date,
): { current: number; longest: number } {
  const prevLongest = existing?.longestStreakDays ?? 0;
  if (!existing?.lastActiveOn) {
    return { current: 1, longest: Math.max(prevLongest, 1) };
  }
  const last = startOfUtcDay(existing.lastActiveOn);
  const diffDays = Math.round((today.getTime() - last.getTime()) / 86_400_000);
  let current: number;
  if (diffDays <= 0)
    current = Math.max(existing.currentStreakDays, 1); // same day
  else if (diffDays === 1) current = existing.currentStreakDays + 1;
  else current = 1; // streak broken
  return { current, longest: Math.max(prevLongest, current) };
}

@Injectable()
export class GamificationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Award XP: append to the Xp ledger and update the profile (xp/level/streak),
   * creating the profile lazily on first activity.
   */
  async award(
    userId: number,
    reason: XpReason,
    amount: number,
    applicationId?: string,
  ): Promise<void> {
    const today = startOfUtcDay(new Date());
    const existing = await this.prisma.gamificationProfile.findUnique({
      where: { userId },
    });
    const newXp = (existing?.xp ?? 0) + amount;
    const newLevel = levelForXp(newXp);
    const { current, longest } = nextStreak(existing, today);

    await this.prisma.$transaction([
      this.prisma.xpEvent.create({
        data: { userId, reason, amount, applicationId: applicationId ?? null },
      }),
      this.prisma.gamificationProfile.upsert({
        where: { userId },
        create: {
          userId,
          xp: newXp,
          level: newLevel,
          currentStreakDays: 1,
          longestStreakDays: 1,
          lastActiveOn: today,
        },
        update: {
          xp: newXp,
          level: newLevel,
          currentStreakDays: current,
          longestStreakDays: longest,
          lastActiveOn: today,
        },
      }),
    ]);
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
      level: profile?.level ?? 1,
      currentStreakDays: profile?.currentStreakDays ?? 0,
      longestStreakDays: profile?.longestStreakDays ?? 0,
      lastActiveOn: profile?.lastActiveOn ?? null,
      xpIntoLevel: xp % XP_PER_LEVEL,
      xpForNextLevel: XP_PER_LEVEL,
      recentXp,
    };
  }

  /** Live values behind each achievement metric — no persistence, just a read. */
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
      level: profile?.level ?? 1,
    };
  }

  /**
   * Catalog + this user's progress on every achievement, unlocking (and
   * awarding XP for) any that newly cross their threshold.
   */
  async listAchievements(userId: number) {
    const [profile, catalog, userRows] = await Promise.all([
      this.prisma.gamificationProfile.findUnique({ where: { userId } }),
      this.prisma.achievement.findMany({ orderBy: { createdAt: 'asc' } }),
      this.prisma.userAchievement.findMany({ where: { userId } }),
    ]);

    const metrics = await this.computeMetrics(userId, profile);
    const byAchievementId = new Map(userRows.map((r) => [r.achievementId, r]));

    const results: {
      id: string;
      code: string;
      name: string;
      description: string;
      icon: string | null;
      xpReward: number;
      threshold: number;
      progress: number;
      unlockedAt: Date | null;
    }[] = [];

    for (const achievement of catalog) {
      const metricKey = ACHIEVEMENT_METRIC[achievement.code] ?? 'applications';
      const value = metrics[metricKey];
      const threshold = achievement.threshold ?? 1;
      const existing = byAchievementId.get(achievement.id);
      let unlockedAt = existing?.unlockedAt ?? null;

      if (!unlockedAt && value >= threshold) {
        const unlocked = await this.prisma.userAchievement.upsert({
          where: {
            userId_achievementId: { userId, achievementId: achievement.id },
          },
          create: {
            userId,
            achievementId: achievement.id,
            progress: value,
            unlockedAt: new Date(),
          },
          update: { progress: value, unlockedAt: new Date() },
        });
        unlockedAt = unlocked.unlockedAt;
        if (achievement.xpReward > 0) {
          await this.award(
            userId,
            XpReason.ACHIEVEMENT_UNLOCKED,
            achievement.xpReward,
          );
        }
      }

      results.push({
        id: achievement.id,
        code: achievement.code,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        xpReward: achievement.xpReward,
        threshold,
        progress: Math.min(value, threshold),
        unlockedAt,
      });
    }

    return results;
  }
}
