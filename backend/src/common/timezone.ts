/**
 * Calendar-day arithmetic in a user's IANA time zone.
 *
 * "Which day is this for that user" is a question UTC cannot answer: an
 * application saved at 00:30 in Europe/Paris happened on the previous UTC day,
 * and a user in Pacific/Auckland spends most of their afternoon already on the
 * next one. Streaks and daily charts are calendar facts, not instants, so they
 * are computed here against the zone the user chose — never the server's, never
 * a fixed offset (which would drift across DST).
 *
 * A `CalendarDay` is a bare 'YYYY-MM-DD' — a date with no time and no zone.
 * Only this module converts between one and an instant.
 */

/** A local calendar date, 'YYYY-MM-DD'. Carries no time and no offset. */
export type CalendarDay = string;

/** Mirrors the `UserSettings.timezone` column default in schema.prisma. */
export const DEFAULT_TIME_ZONE = 'Europe/Paris';

const MS_PER_DAY = 86_400_000;

const SUPPORTED_TIME_ZONES = new Set(Intl.supportedValuesOf('timeZone'));

/** True for identifiers the runtime's ICU data actually knows. */
export function isSupportedTimeZone(value: unknown): value is string {
  return typeof value === 'string' && SUPPORTED_TIME_ZONES.has(value);
}

/**
 * Coerce a stored zone into a usable one. Values read back from the database
 * get the same distrust as request input: a row restored from a backup, or
 * written before this column was validated, must degrade to the default rather
 * than throw a RangeError deep inside a write path.
 */
export function resolveTimeZone(value: unknown): string {
  return isSupportedTimeZone(value) ? value : DEFAULT_TIME_ZONE;
}

// Building a DateTimeFormat is expensive relative to formatting with one, and
// these run per awarded XP event and per charted row.
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function zonedFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      // h23 rather than hour12:false — the latter renders midnight as "24"
      // under some ICU versions, which would silently land on the wrong day.
      hourCycle: 'h23',
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function partsIn(instant: Date, timeZone: string): ZonedParts {
  const parts = zonedFormatter(timeZone).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((p) => p.type === type);
    return part ? Number(part.value) : 0;
  };
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}

const pad = (value: number, width: number): string =>
  String(value).padStart(width, '0');

/** The calendar date an instant falls on, as seen from `timeZone`. */
export function calendarDayIn(instant: Date, timeZone: string): CalendarDay {
  const { year, month, day } = partsIn(instant, timeZone);
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/**
 * The instant a calendar date is pinned to for storage: midnight UTC. A stored
 * `lastActiveOn` is a date, not a moment — pinning it to UTC keeps day
 * comparisons exact regardless of where the user was when it was written.
 */
export function calendarDayToUtcMidnight(day: CalendarDay): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/** Read a stored calendar date (see above) back into a `CalendarDay`. */
export function calendarDayFromStored(stored: Date): CalendarDay {
  return calendarDayIn(stored, 'UTC');
}

/** Shift a calendar date by whole days. DST-proof: no instants involved. */
export function addCalendarDays(day: CalendarDay, delta: number): CalendarDay {
  const shifted = calendarDayToUtcMidnight(day);
  shifted.setUTCDate(shifted.getUTCDate() + delta);
  return calendarDayFromStored(shifted);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function calendarDaysBetween(
  from: CalendarDay,
  to: CalendarDay,
): number {
  const diff =
    calendarDayToUtcMidnight(to).getTime() -
    calendarDayToUtcMidnight(from).getTime();
  return Math.round(diff / MS_PER_DAY);
}

/** The zone's UTC offset, in ms, at a given instant (positive east of UTC). */
function offsetMsAt(instant: Date, timeZone: string): number {
  const { year, month, day, hour, minute, second } = partsIn(instant, timeZone);
  const asIfUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  // The formatted parts have no milliseconds; drop them from the instant too,
  // or every offset comes out a few hundred ms off.
  const whole = Math.floor(instant.getTime() / 1000) * 1000;
  return asIfUtc - whole;
}

/**
 * An instant guaranteed to be at or before the first moment of `day` in
 * `timeZone` — the lower bound for "rows belonging to this local day onwards".
 *
 * Deliberately not exact. Resolving a local midnight needs the offset that
 * applies *at* that midnight, which is circular, and on the rare DST
 * transitions that land on midnight itself the local time is either skipped or
 * repeated. Two passes converge everywhere else; taking the earlier candidate
 * makes the remaining error always an over-fetch of at most an hour, never a
 * silently missing row. Callers must bucket results by
 * {@link calendarDayIn} and discard days they did not ask for.
 */
export function earliestInstantOfCalendarDay(
  day: CalendarDay,
  timeZone: string,
): Date {
  const naive = calendarDayToUtcMidnight(day).getTime();
  const firstPass = naive - offsetMsAt(new Date(naive), timeZone);
  const secondPass = naive - offsetMsAt(new Date(firstPass), timeZone);
  return new Date(Math.min(firstPass, secondPass));
}
