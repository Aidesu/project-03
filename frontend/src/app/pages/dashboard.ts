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
import { DailyApplicationStat, GamificationProfile } from '../core/models';

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

// A small accent dot per reason — identity without a legend, in the ledger feed.
const XP_REASON_ACCENT: Record<string, string> = {
  APPLICATION_CREATED: 'bg-brand-300',
  APPLICATION_SUBMITTED: 'bg-brand-500',
  INTERVIEW_SCHEDULED: 'bg-aurora-violet/60',
  INTERVIEW_COMPLETED: 'bg-aurora-violet',
  OFFER_RECEIVED: 'bg-emerald-400',
  OFFER_ACCEPTED: 'bg-emerald-600',
  STREAK_BONUS: 'bg-stamp-500',
  DAILY_GOAL: 'bg-brand-400',
  WEEKLY_GOAL: 'bg-aurora-violet',
  ACHIEVEMENT_UNLOCKED: 'bg-xp-500',
  OTHER: 'bg-slate-300',
};

// How far back the heatmap looks — 12 full weeks, GitHub-style.
const HEATMAP_WEEKS = 12;
const HEATMAP_DAYS = HEATMAP_WEEKS * 7;

// One CSS color class per activity level (0 = none) — ink density rising to a
// gold "stamped" peak on the busiest days, echoing the seal/medal palette.
const HEAT_LEVEL_CLASS = ['bg-slate-100', 'bg-[#C9D5E8]', 'bg-[#8FA3C0]', 'bg-brand-500', 'bg-xp-500'];

function heatLevel(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

interface HeatCell {
  date: string;
  count: number;
  level: number;
  label: string;
}

/** Groups a run of days (oldest first) into Monday-start week columns, padding the first week. */
function buildHeatmapWeeks(stats: DailyApplicationStat[]): (HeatCell | null)[][] {
  if (stats.length === 0) return [];
  const first = new Date(`${stats[0].date}T00:00:00Z`);
  const leadingPad = (first.getUTCDay() + 6) % 7; // days since Monday

  const cells: (HeatCell | null)[] = [
    ...Array.from({ length: leadingPad }, () => null),
    ...stats.map((s) => ({
      date: s.date,
      count: s.count,
      level: heatLevel(s.count),
      label: new Date(`${s.date}T00:00:00Z`).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    })),
  ];

  const weeks: (HeatCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// Chart geometry. The viewBox width tracks the container's real pixel width (via
// ResizeObserver) so text stays crisp at its defined size instead of shrinking
// with the SVG on narrow screens — only the height and paddings are fixed.
const CHART_WIDTH_FALLBACK = 640;
const CHART_HEIGHT = 230;
const PAD_LEFT = 32;
const PAD_RIGHT = 8;
const PAD_TOP = 40; // headroom for the hover tooltip above the tallest bar
const PAD_BOTTOM = 24;
const BAR_MAX_WIDTH = 32;
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
  fullLabel: string;
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
  /** Last 12 weeks of daily counts, oldest first — feeds both the chart and the heatmap. */
  readonly dailyStats = signal<DailyApplicationStat[] | null>(null);
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
  readonly tooltipWidth = 116;
  readonly tooltipHeight = 34;

  /** Fill % of the ledger progress bar toward the next rank. */
  readonly ringPct = computed(() => {
    const p = this.profile();
    if (!p || p.xpForNextLevel === 0) return 0;
    return Math.min(100, Math.round((p.xpIntoLevel / p.xpForNextLevel) * 100));
  });

  /** Last 7 days as a punch-card row (true = at least one application that day). */
  readonly streakPunches = computed(() => {
    const stats = this.chartStats();
    const padded = stats.length < 7 ? [...Array(7 - stats.length).fill(null), ...stats] : stats;
    return padded.map((s) => (s ? s.count > 0 : false));
  });

  readonly firstName = computed(() => {
    const u = this.user();
    const base = u?.name?.trim() || u?.email || '';
    return base.split(/[@\s]/)[0];
  });

  readonly initials = computed(() => {
    const u = this.user();
    if (!u) return '?';
    const source = u.name?.trim() || u.email;
    return source.slice(0, 2).toUpperCase();
  });

  /** Just the last 7 days, for the bar chart — the heatmap uses the full range. */
  private readonly chartStats = computed(() => (this.dailyStats() ?? []).slice(-7));

  readonly heatmapWeeks = computed(() => buildHeatmapWeeks(this.dailyStats() ?? []));

  /** One label (or null) per week column — the short month name, shown only where the month changes. */
  readonly heatmapMonthLabels = computed<(string | null)[]>(() => {
    const labels: (string | null)[] = [];
    let lastMonth = -1;
    for (const week of this.heatmapWeeks()) {
      const firstCell = week.find((c): c is HeatCell => c !== null);
      if (!firstCell) {
        labels.push(null);
        continue;
      }
      const month = new Date(`${firstCell.date}T00:00:00Z`).getUTCMonth();
      if (month === lastMonth) {
        labels.push(null);
        continue;
      }
      lastMonth = month;
      labels.push(new Date(`${firstCell.date}T00:00:00Z`).toLocaleDateString('fr-FR', { month: 'short' }));
    }
    return labels;
  });

  readonly heatmapDayLabels = ['Lun', '', 'Mer', '', 'Ven', '', ''];

  private readonly axisMax = computed(() => {
    return niceMax(Math.max(0, ...this.chartStats().map((d) => d.count)));
  });

  readonly yTicks = computed(() => {
    const max = this.axisMax();
    return [0, max / 2, max].map((value) => ({
      value: Math.round(value),
      y: PAD_TOP + PLOT_HEIGHT - (value / max) * PLOT_HEIGHT,
    }));
  });

  readonly chartPoints = computed<ChartPoint[]>(() => {
    const stats = this.chartStats();
    if (stats.length === 0) return [];
    const max = this.axisMax();
    const plotWidth = this.chartWidth() - PAD_LEFT - PAD_RIGHT;
    const band = plotWidth / stats.length;
    const barWidth = Math.min(BAR_MAX_WIDTH, band * 0.55);

    return stats.map((d, i) => {
      const rawHeight = (d.count / max) * PLOT_HEIGHT;
      const height = d.count > 0 ? Math.max(MIN_BAR_HEIGHT, rawHeight) : 0;
      const x = PAD_LEFT + i * band + (band - barWidth) / 2;
      const date = new Date(d.date);
      return {
        label: date.toLocaleDateString('fr-FR', { weekday: 'short' }),
        fullLabel: date.toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }),
        count: d.count,
        x,
        width: barWidth,
        y: PAD_TOP + PLOT_HEIGHT - height,
        height,
        centerX: x + barWidth / 2,
      };
    });
  });

  readonly periodTotal = computed(() => this.chartStats().reduce((sum, d) => sum + d.count, 0));

  readonly dailyDelta = computed(() => {
    const stats = this.chartStats();
    if (stats.length < 2) return null;
    const today = stats[stats.length - 1].count;
    const yesterday = stats[stats.length - 2].count;
    return { today, delta: today - yesterday };
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
    this.applications.getDailyStats(HEATMAP_DAYS).subscribe({
      next: (stats) => {
        this.dailyStats.set(stats);
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

  heatCellClass(level: number): string {
    return HEAT_LEVEL_CLASS[level] ?? HEAT_LEVEL_CLASS[0];
  }

  heatCellTitle(cell: HeatCell): string {
    return `${cell.count} candidature${cell.count === 1 ? '' : 's'} — ${cell.label}`;
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
