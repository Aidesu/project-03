import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApplicationsService } from '../core/applications.service';
import { AuthService } from '../core/auth.service';
import { GamificationService } from '../core/gamification.service';
import { GamificationProfile, WeeklyApplicationStat } from '../core/models';
import { RING_CIRCUMFERENCE, ringOffset } from '../core/xp-ring';

const XP_REASON_LABEL: Record<string, string> = {
  APPLICATION_CREATED: 'Candidature ajoutée',
  APPLICATION_SUBMITTED: 'Candidature envoyée',
  INTERVIEW_SCHEDULED: 'Entretien planifié',
  INTERVIEW_COMPLETED: 'Entretien passé',
  OFFER_RECEIVED: 'Offre reçue',
  OFFER_ACCEPTED: 'Offre acceptée',
  STREAK_BONUS: 'Bonus de série',
  DAILY_GOAL: 'Objectif quotidien',
  WEEKLY_GOAL: 'Objectif hebdomadaire',
  ACHIEVEMENT_UNLOCKED: 'Succès débloqué',
  OTHER: 'Activité',
};

// A small accent dot per reason — identity without a legend, per the app's timeline feed.
const XP_REASON_ACCENT: Record<string, string> = {
  APPLICATION_CREATED: 'bg-brand-400',
  APPLICATION_SUBMITTED: 'bg-brand-500',
  INTERVIEW_SCHEDULED: 'bg-xp-400',
  INTERVIEW_COMPLETED: 'bg-xp-500',
  OFFER_RECEIVED: 'bg-emerald-400',
  OFFER_ACCEPTED: 'bg-emerald-600',
  STREAK_BONUS: 'bg-xp-500',
  DAILY_GOAL: 'bg-xp-400',
  WEEKLY_GOAL: 'bg-xp-500',
  ACHIEVEMENT_UNLOCKED: 'bg-brand-600',
  OTHER: 'bg-slate-300',
};

// Chart geometry. The viewBox width tracks the container's real pixel width (via
// ResizeObserver) so text stays crisp at its defined size instead of shrinking
// with the SVG on narrow screens — only the height and paddings are fixed.
const CHART_WIDTH_FALLBACK = 640;
const CHART_HEIGHT = 210;
const PAD_LEFT = 30;
const PAD_RIGHT = 8;
const PAD_TOP = 44; // headroom for the hover tooltip above the tallest bar
const PAD_BOTTOM = 24;
const BAR_MAX_WIDTH = 24;
const MIN_BAR_HEIGHT = 6;
const PLOT_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

/** Round a max value up to a clean axis ceiling (0 / 5 / 10 / 20 / 50 …). */
function niceMax(max: number): number {
  if (max <= 4) return 4;
  const step = max <= 10 ? 2 : max <= 20 ? 5 : max <= 50 ? 10 : 20;
  return Math.ceil(max / step) * step;
}

interface ChartPoint {
  label: string;
  count: number;
  x: number;
  width: number;
  y: number;
  height: number;
  centerX: number;
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
})
export class Dashboard implements AfterViewInit, OnDestroy {
  private readonly gamification = inject(GamificationService);
  private readonly applications = inject(ApplicationsService);
  private readonly auth = inject(AuthService);

  @ViewChild('chartWrap') private chartWrapRef?: ElementRef<HTMLDivElement>;
  private resizeObserver?: ResizeObserver;

  readonly user = this.auth.user;
  readonly profile = signal<GamificationProfile | null>(null);
  readonly weeklyStats = signal<WeeklyApplicationStat[] | null>(null);
  readonly profileLoaded = signal(false);
  readonly statsLoaded = signal(false);
  readonly loading = computed(() => !this.profileLoaded() || !this.statsLoaded());
  readonly error = signal(false);

  readonly hoveredIndex = signal<number | null>(null);

  readonly chartWidth = signal(CHART_WIDTH_FALLBACK);
  readonly chartHeight = CHART_HEIGHT;
  readonly padLeft = PAD_LEFT;
  readonly plotTop = PAD_TOP;
  readonly plotRight = computed(() => this.chartWidth() - PAD_RIGHT);
  readonly baselineY = PAD_TOP + PLOT_HEIGHT;
  readonly labelY = CHART_HEIGHT - 6;
  readonly tooltipWidth = 104;
  readonly tooltipHeight = 30;

  readonly ringPct = computed(() => {
    const p = this.profile();
    if (!p || p.xpForNextLevel === 0) return 0;
    return Math.min(100, Math.round((p.xpIntoLevel / p.xpForNextLevel) * 100));
  });

  readonly ringOffsetValue = computed(() => ringOffset(this.ringPct(), RING_CIRCUMFERENCE));

  readonly ringCircumference = RING_CIRCUMFERENCE;

  readonly firstName = computed(() => {
    const u = this.user();
    const base = u?.name?.trim() || u?.email || '';
    return base.split(/[@\s]/)[0];
  });

  private readonly axisMax = computed(() => {
    const stats = this.weeklyStats() ?? [];
    return niceMax(Math.max(0, ...stats.map((w) => w.count)));
  });

  readonly yTicks = computed(() => {
    const max = this.axisMax();
    return [0, max / 2, max].map((value) => ({
      value: Math.round(value),
      y: PAD_TOP + PLOT_HEIGHT - (value / max) * PLOT_HEIGHT,
    }));
  });

  readonly chartPoints = computed<ChartPoint[]>(() => {
    const stats = this.weeklyStats();
    if (!stats || stats.length === 0) return [];
    const max = this.axisMax();
    const plotWidth = this.chartWidth() - PAD_LEFT - PAD_RIGHT;
    const band = plotWidth / stats.length;
    const barWidth = Math.min(BAR_MAX_WIDTH, band * 0.55);

    return stats.map((w, i) => {
      const rawHeight = (w.count / max) * PLOT_HEIGHT;
      const height = w.count > 0 ? Math.max(MIN_BAR_HEIGHT, rawHeight) : 0;
      const x = PAD_LEFT + i * band + (band - barWidth) / 2;
      return {
        label: new Date(w.weekStart).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
        }),
        count: w.count,
        x,
        width: barWidth,
        y: PAD_TOP + PLOT_HEIGHT - height,
        height,
        centerX: x + barWidth / 2,
      };
    });
  });

  readonly periodTotal = computed(() =>
    (this.weeklyStats() ?? []).reduce((sum, w) => sum + w.count, 0),
  );

  readonly weeklyDelta = computed(() => {
    const stats = this.weeklyStats();
    if (!stats || stats.length < 2) return null;
    const last = stats[stats.length - 1].count;
    const previous = stats[stats.length - 2].count;
    return { last, delta: last - previous };
  });

  constructor() {
    this.gamification.getProfile().subscribe({
      next: (p) => {
        this.profile.set(p);
        this.profileLoaded.set(true);
      },
      error: () => {
        this.error.set(true);
        this.profileLoaded.set(true);
      },
    });
    this.applications.getWeeklyStats(8).subscribe({
      next: (stats) => {
        this.weeklyStats.set(stats);
        this.statsLoaded.set(true);
      },
      error: () => {
        this.error.set(true);
        this.statsLoaded.set(true);
      },
    });
  }

  ngAfterViewInit(): void {
    const el = this.chartWrapRef?.nativeElement;
    if (!el || typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width;
      if (width) this.chartWidth.set(Math.round(width));
    });
    this.resizeObserver.observe(el);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  reasonLabel(reason: string): string {
    return XP_REASON_LABEL[reason] ?? reason;
  }

  reasonAccent(reason: string): string {
    return XP_REASON_ACCENT[reason] ?? 'bg-slate-300';
  }

  /** Clamped so the tooltip never overflows the chart's left/right edge. */
  tooltipX(point: ChartPoint): number {
    const min = PAD_LEFT;
    const max = this.chartWidth() - PAD_RIGHT - this.tooltipWidth;
    return Math.min(max, Math.max(min, point.centerX - this.tooltipWidth / 2));
  }

  formatDelta(delta: number): string {
    if (delta > 0) return `+${delta}`;
    if (delta < 0) return `${delta}`;
    return '±0';
  }
}
