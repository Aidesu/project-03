import {
  addCalendarDays,
  calendarDayFromStored,
  calendarDayIn,
  calendarDaysBetween,
  calendarDayToUtcMidnight,
  DEFAULT_TIME_ZONE,
  earliestInstantOfCalendarDay,
  isSupportedTimeZone,
  resolveTimeZone,
} from './timezone';

describe('calendarDayIn', () => {
  it('reports the local date, not the UTC one, east of UTC', () => {
    // 22:00 UTC is already the next morning in Auckland (UTC+13 in January).
    const instant = new Date('2026-01-14T22:00:00.000Z');
    expect(calendarDayIn(instant, 'UTC')).toBe('2026-01-14');
    expect(calendarDayIn(instant, 'Pacific/Auckland')).toBe('2026-01-15');
  });

  it('reports the local date, not the UTC one, west of UTC', () => {
    // 02:00 UTC is still the previous evening in Los Angeles.
    const instant = new Date('2026-01-15T02:00:00.000Z');
    expect(calendarDayIn(instant, 'America/Los_Angeles')).toBe('2026-01-14');
  });

  it('keeps a just-past-midnight submission on the day the user sees', () => {
    // The case that started this: 00:30 in Paris, still yesterday in UTC.
    const instant = new Date('2026-08-01T22:30:00.000Z');
    expect(calendarDayIn(instant, 'UTC')).toBe('2026-08-01');
    expect(calendarDayIn(instant, 'Europe/Paris')).toBe('2026-08-02');
  });

  it('handles midnight exactly, without rolling to hour 24', () => {
    expect(calendarDayIn(new Date('2026-03-01T00:00:00.000Z'), 'UTC')).toBe(
      '2026-03-01',
    );
  });
});

describe('calendar day arithmetic', () => {
  it('round-trips a day through its stored UTC-midnight form', () => {
    expect(calendarDayFromStored(calendarDayToUtcMidnight('2026-02-28'))).toBe(
      '2026-02-28',
    );
  });

  it('crosses a DST boundary without losing or gaining a day', () => {
    // Europe/Paris springs forward on 2026-03-29. Instant arithmetic on a
    // 24h constant would land on the 28th here.
    expect(addCalendarDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addCalendarDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(calendarDaysBetween('2026-03-28', '2026-03-30')).toBe(2);
  });

  it('crosses a leap day and a year boundary', () => {
    expect(addCalendarDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(calendarDaysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('counts backwards as negative', () => {
    expect(calendarDaysBetween('2026-01-15', '2026-01-14')).toBe(-1);
    expect(addCalendarDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('earliestInstantOfCalendarDay', () => {
  const startsBeforeOrAtLocalMidnight = (day: string, timeZone: string) => {
    const bound = earliestInstantOfCalendarDay(day, timeZone);
    // Never later than the first moment of the day...
    expect(calendarDayIn(bound, timeZone) <= day).toBe(true);
    // ...and never so early that it drags in a day we did not ask for.
    expect(
      calendarDaysBetween(calendarDayIn(bound, timeZone), day),
    ).toBeLessThanOrEqual(1);
  };

  it('lands on the local start of day for a zone east of UTC', () => {
    expect(
      earliestInstantOfCalendarDay('2026-01-13', 'Pacific/Auckland'),
    ).toEqual(new Date('2026-01-12T11:00:00.000Z'));
  });

  it('lands on the local start of day for a zone west of UTC', () => {
    expect(
      earliestInstantOfCalendarDay('2026-01-13', 'America/Los_Angeles'),
    ).toEqual(new Date('2026-01-13T08:00:00.000Z'));
  });

  it('never overshoots across DST transitions, including midnight ones', () => {
    // Spring-forward and fall-back days in zones that transition at or near
    // midnight — where a naive single-pass offset lookup misses rows.
    startsBeforeOrAtLocalMidnight('2026-03-29', 'Europe/Paris');
    startsBeforeOrAtLocalMidnight('2026-10-25', 'Europe/Paris');
    startsBeforeOrAtLocalMidnight('2026-09-06', 'America/Santiago');
    startsBeforeOrAtLocalMidnight('2026-04-05', 'America/Santiago');
    startsBeforeOrAtLocalMidnight('2026-10-04', 'Australia/Lord_Howe');
  });
});

describe('resolveTimeZone', () => {
  it('accepts a known IANA identifier', () => {
    expect(isSupportedTimeZone('Europe/Paris')).toBe(true);
    expect(resolveTimeZone('Asia/Tokyo')).toBe('Asia/Tokyo');
  });

  it('falls back rather than throwing on junk read back from storage', () => {
    // An invalid zone reaching Intl is a RangeError inside a write path, so
    // this degrades instead — the same distrust applied to request input.
    for (const junk of ['UTC+2', 'Mars/Olympus', '', null, undefined, 42]) {
      expect(resolveTimeZone(junk)).toBe(DEFAULT_TIME_ZONE);
    }
  });
});
