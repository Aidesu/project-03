import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-player-card',
  imports: [RouterLink],
  templateUrl: './player-card.html',
})
export class PlayerCard {
  readonly level = input.required<number>();
  readonly xp = input.required<number>();
  readonly xpIntoLevel = input.required<number>();
  readonly xpForNextLevel = input.required<number>();
  readonly currentStreakDays = input.required<number>();
  readonly longestStreakDays = input.required<number>();

  readonly displayName = input.required<string>();
  readonly avatarUrl = input<string | null>(null);
  readonly initials = input<string>('?');
  /** Overline greeting (e.g. "Salut Alice 👋"); falls back to the display name when absent. */
  readonly greeting = input<string | null>(null);
  /** Last 7 days, oldest first — omit to fall back to a plain streak readout. */
  readonly streakPunches = input<boolean[] | null>(null);
  readonly showAchievementsLink = input(false);

  readonly xpPct = computed(() => {
    const total = this.xpForNextLevel();
    if (!total) return 0;
    return Math.min(100, Math.max(0, Math.round((this.xpIntoLevel() / total) * 100)));
  });

  /** Same value, clamped so the trail marker never clips the card edge at 0%/100%. */
  readonly xpDotPct = computed(() => Math.min(97, Math.max(3, this.xpPct())));
}
