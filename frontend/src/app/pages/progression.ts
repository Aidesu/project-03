import { Component, computed, inject, signal } from '@angular/core';
import {
  ACHIEVEMENT_CATEGORY_ORDER,
  AchievementCategory,
  achievementCategory,
  toRoman,
} from '../core/enums';
import { GamificationService } from '../core/gamification.service';
import { Achievement, GamificationProfile } from '../core/models';
import { RING_CIRCUMFERENCE, ringOffset } from '../core/xp-ring';

interface RankedAchievement extends Achievement {
  tier: string;
}

interface AchievementGroup {
  category: AchievementCategory;
  achievements: RankedAchievement[];
}

@Component({
  selector: 'app-progression',
  templateUrl: './progression.html',
})
export class Progression {
  private readonly gamification = inject(GamificationService);

  readonly profile = signal<GamificationProfile | null>(null);
  readonly achievements = signal<Achievement[] | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);

  readonly ringPct = computed(() => {
    const p = this.profile();
    if (!p || p.xpForNextLevel === 0) return 0;
    return Math.min(100, Math.round((p.xpIntoLevel / p.xpForNextLevel) * 100));
  });

  readonly ringOffsetValue = computed(() => ringOffset(this.ringPct(), RING_CIRCUMFERENCE));

  readonly ringCircumference = RING_CIRCUMFERENCE;

  readonly unlockedCount = computed(
    () => this.achievements()?.filter((a) => a.unlockedAt).length ?? 0,
  );

  readonly totalCount = computed(() => this.achievements()?.length ?? 0);

  readonly streakMessage = computed(() => {
    const p = this.profile();
    if (!p || p.currentStreakDays === 0) {
      return 'Ajoute une candidature aujourd’hui pour démarrer une série.';
    }
    return `Série en cours — continue comme ça.`;
  });

  readonly groups = computed<AchievementGroup[]>(() => {
    const list = this.achievements();
    if (!list) return [];

    const byCategory = new Map<AchievementCategory, Achievement[]>();
    for (const a of list) {
      const category = achievementCategory(a.code);
      byCategory.set(category, [...(byCategory.get(category) ?? []), a]);
    }

    return ACHIEVEMENT_CATEGORY_ORDER.filter((category) => byCategory.has(category)).map(
      (category) => {
        const sorted = [...byCategory.get(category)!].sort((a, b) => a.threshold - b.threshold);
        return {
          category,
          achievements: sorted.map((a, i) => ({
            ...a,
            tier: sorted.length > 1 ? toRoman(i + 1) : '',
          })),
        };
      },
    );
  });

  constructor() {
    this.gamification.getProfile().subscribe({
      next: (p) => this.profile.set(p),
      error: () => this.error.set(true),
    });
    this.gamification.getAchievements().subscribe({
      next: (a) => {
        this.achievements.set(a);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
}
