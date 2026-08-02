import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../core/auth.service';
import {
  ACHIEVEMENT_CATEGORY_KEYS,
  ACHIEVEMENT_CATEGORY_ORDER,
  AchievementCategory,
  achievementCategory,
  achievementDescription,
  achievementName,
  toRoman,
} from '../core/enums';
import { GamificationService } from '../core/gamification.service';
import { I18nService } from '../core/i18n';
import { initialsOf } from '../core/initials';
import { Achievement, GamificationProfile } from '../core/models';
import { PlayerCard } from '../shared/player-card/player-card';

/** An achievement with its tier numeral and its labels resolved for display. */
interface RankedAchievement extends Achievement {
  tier: string;
  displayName: string;
  displayDescription: string;
}

interface AchievementGroup {
  category: AchievementCategory;
  categoryLabel: string;
  achievements: RankedAchievement[];
}

@Component({
  selector: 'app-progression',
  imports: [PlayerCard],
  templateUrl: './progression.html',
})
export class Progression {
  private readonly gamification = inject(GamificationService);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);

  readonly t = this.i18n.t;
  readonly dateLong = this.i18n.dateLong;
  readonly user = this.auth.user;
  readonly profile = signal<GamificationProfile | null>(null);
  readonly achievements = signal<Achievement[] | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);

  readonly displayName = computed(() => this.user()?.name?.trim() || this.user()?.email || '');
  readonly avatarUrl = computed(() => this.user()?.avatarUrl ?? null);
  readonly initials = computed(() => initialsOf(this.user()?.name || this.user()?.email));

  readonly unlockedCount = computed(
    () => this.achievements()?.filter((a) => a.unlockedAt).length ?? 0,
  );

  readonly totalCount = computed(() => this.achievements()?.length ?? 0);

  readonly streakMessage = computed(() => {
    const p = this.profile();
    if (!p || p.currentStreakDays === 0) return this.t('progression.streakNone');
    return this.t('progression.streakActive');
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
          categoryLabel: this.t(ACHIEVEMENT_CATEGORY_KEYS[category]),
          achievements: sorted.map((a, i) => ({
            ...a,
            tier: sorted.length > 1 ? toRoman(i + 1) : '',
            displayName: achievementName(a.code, a.name, this.t),
            displayDescription: achievementDescription(a.code, a.description, this.t),
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

}
