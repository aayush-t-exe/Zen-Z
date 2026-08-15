import { describe, expect, it } from 'vitest';
import {
  weekStartOf,
  weekLabel,
  lastNWeeks,
  dayStartOf,
  dayLabel,
  lastNDays,
  formatINR,
  computeWeeklyBookings,
  computeDailyBookings,
  computeNoShowTrend,
  computeWeeklySignups,
  computeDailySignups,
  computeTotals,
  ACTIVITY_ORDER,
  type BookingRow,
} from './calculations';

// A fixed Thursday, so week-boundary math is deterministic across runs.
const REFERENCE = new Date('2026-08-13T12:00:00Z');

describe('weekStartOf', () => {
  it('rolls a mid-week date back to that week\'s Sunday, midnight', () => {
    const start = weekStartOf('2026-08-13T12:00:00Z');
    expect(start.getDay()).toBe(0);
    expect(start.getHours()).toBe(0);
  });

  it('leaves a Sunday date at the same day', () => {
    const start = weekStartOf('2026-08-09T00:00:00');
    expect(start.getDate()).toBe(9);
  });
});

describe('weekLabel', () => {
  it('formats a date with the short month and day, en-IN locale order', () => {
    expect(weekLabel(new Date('2026-08-09T00:00:00'))).toBe('9 Aug');
  });
});

describe('lastNWeeks', () => {
  it('returns n weeks ending on the current week, oldest first', () => {
    const weeks = lastNWeeks(8, REFERENCE);
    expect(weeks).toHaveLength(8);
    for (let i = 1; i < weeks.length; i++) {
      expect(weeks[i].getTime() - weeks[i - 1].getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    }
    expect(weeks[weeks.length - 1].getTime()).toBe(weekStartOf(REFERENCE.toISOString()).getTime());
  });
});

describe('formatINR', () => {
  it('formats a whole rupee amount with the ₹ prefix and Indian grouping', () => {
    expect(formatINR(150000)).toBe('₹1,50,000');
  });

  it('rounds a fractional amount', () => {
    expect(formatINR(99.6)).toBe('₹100');
  });
});

function booking(overrides: Partial<BookingRow>): BookingRow {
  return {
    id: 'b1',
    user_id: 'u1',
    status: 'matched',
    payment_status: 'paid',
    slot_datetime: REFERENCE.toISOString(),
    activity_name: 'Cafés',
    convenience_fee: 21,
    ...overrides,
  };
}

describe('computeWeeklyBookings', () => {
  it('buckets a booking into its event week and activity column', () => {
    const buckets = computeWeeklyBookings([booking({})], ACTIVITY_ORDER, 8, REFERENCE);
    const thisWeek = buckets[buckets.length - 1];
    expect(thisWeek.total).toBe(1);
    expect(thisWeek['Cafés']).toBe(1);
    expect(thisWeek.revenue).toBe(21);
  });

  it('drops an unpaid booking\'s fee out of the revenue bucket', () => {
    const buckets = computeWeeklyBookings(
      [booking({ payment_status: 'unpaid' })],
      ACTIVITY_ORDER,
      8,
      REFERENCE
    );
    expect(buckets[buckets.length - 1].revenue).toBe(0);
  });

  it('files an unrecognized activity name under "Other"', () => {
    const buckets = computeWeeklyBookings(
      [booking({ activity_name: 'Trivia Night' })],
      ACTIVITY_ORDER,
      8,
      REFERENCE
    );
    expect(buckets[buckets.length - 1]['Other']).toBe(1);
  });

  it('drops a booking outside the requested week window instead of throwing', () => {
    const old = new Date(REFERENCE);
    old.setDate(old.getDate() - 90);
    const buckets = computeWeeklyBookings([booking({ slot_datetime: old.toISOString() })], ACTIVITY_ORDER, 8, REFERENCE);
    expect(buckets.reduce((sum, b) => sum + (b.total as number), 0)).toBe(0);
  });

  it('still returns 8 zero-filled weeks with no bookings at all', () => {
    const buckets = computeWeeklyBookings([], ACTIVITY_ORDER, 8, REFERENCE);
    expect(buckets).toHaveLength(8);
    expect(buckets.every((b) => b.total === 0 && b.revenue === 0)).toBe(true);
  });
});

describe('dayStartOf', () => {
  it('rolls a mid-day timestamp back to that day\'s midnight', () => {
    const start = dayStartOf('2026-08-13T18:45:00Z');
    expect(start.getHours()).toBe(0);
    expect(start.getDate()).toBe(new Date('2026-08-13T18:45:00Z').getDate());
  });
});

describe('dayLabel', () => {
  it('formats a date with the short month and day, en-IN locale order', () => {
    expect(dayLabel(new Date('2026-08-09T00:00:00'))).toBe('9 Aug');
  });
});

describe('lastNDays', () => {
  it('returns n days ending today, oldest first', () => {
    const days = lastNDays(14, REFERENCE);
    expect(days).toHaveLength(14);
    for (let i = 1; i < days.length; i++) {
      expect(days[i].getTime() - days[i - 1].getTime()).toBe(24 * 60 * 60 * 1000);
    }
    expect(days[days.length - 1].getTime()).toBe(dayStartOf(REFERENCE.toISOString()).getTime());
  });
});

describe('computeDailyBookings', () => {
  it('buckets a booking into its event day and activity column', () => {
    const buckets = computeDailyBookings([booking({})], ACTIVITY_ORDER, 14, REFERENCE);
    const today = buckets[buckets.length - 1];
    expect(today.total).toBe(1);
    expect(today['Cafés']).toBe(1);
    expect(today.revenue).toBe(21);
  });

  it('drops an unpaid booking\'s fee out of the revenue bucket', () => {
    const buckets = computeDailyBookings(
      [booking({ payment_status: 'unpaid' })],
      ACTIVITY_ORDER,
      14,
      REFERENCE
    );
    expect(buckets[buckets.length - 1].revenue).toBe(0);
  });

  it('drops a booking outside the requested day window instead of throwing', () => {
    const old = new Date(REFERENCE);
    old.setDate(old.getDate() - 90);
    const buckets = computeDailyBookings([booking({ slot_datetime: old.toISOString() })], ACTIVITY_ORDER, 14, REFERENCE);
    expect(buckets.reduce((sum, b) => sum + (b.total as number), 0)).toBe(0);
  });

  it('still returns 14 zero-filled days with no bookings at all', () => {
    const buckets = computeDailyBookings([], ACTIVITY_ORDER, 14, REFERENCE);
    expect(buckets).toHaveLength(14);
    expect(buckets.every((b) => b.total === 0 && b.revenue === 0)).toBe(true);
  });
});

describe('computeNoShowTrend', () => {
  it('counts a no-show date into its week bucket', () => {
    const trend = computeNoShowTrend([REFERENCE.toISOString()], 8, REFERENCE);
    expect(trend[trend.length - 1].count).toBe(1);
  });

  it('ignores a no-show date outside the window', () => {
    const old = new Date(REFERENCE);
    old.setDate(old.getDate() - 90);
    const trend = computeNoShowTrend([old.toISOString()], 8, REFERENCE);
    expect(trend.reduce((sum, b) => sum + b.count, 0)).toBe(0);
  });
});

describe('computeWeeklySignups', () => {
  it('counts a signup date into its week bucket', () => {
    const trend = computeWeeklySignups([REFERENCE.toISOString()], 8, REFERENCE);
    expect(trend[trend.length - 1].count).toBe(1);
  });

  it('ignores a signup date outside the window', () => {
    const old = new Date(REFERENCE);
    old.setDate(old.getDate() - 90);
    const trend = computeWeeklySignups([old.toISOString()], 8, REFERENCE);
    expect(trend.reduce((sum, b) => sum + b.count, 0)).toBe(0);
  });
});

describe('computeDailySignups', () => {
  it('counts a signup date into its day bucket', () => {
    const trend = computeDailySignups([REFERENCE.toISOString()], 14, REFERENCE);
    expect(trend[trend.length - 1].count).toBe(1);
  });

  it('ignores a signup date outside the window', () => {
    const old = new Date(REFERENCE);
    old.setDate(old.getDate() - 90);
    const trend = computeDailySignups([old.toISOString()], 14, REFERENCE);
    expect(trend.reduce((sum, b) => sum + b.count, 0)).toBe(0);
  });
});

describe('computeTotals', () => {
  it('computes payment conversion and matched counts', () => {
    const totals = computeTotals([
      booking({ payment_status: 'paid', status: 'matched' }),
      booking({ payment_status: 'unpaid', status: 'pending_match' }),
    ]);
    expect(totals.totalBookings).toBe(2);
    expect(totals.paid).toBe(1);
    expect(totals.matched).toBe(1);
    expect(totals.paymentConversionPct).toBe(50);
  });

  it('sums convenience_fee only across paid bookings for revenue', () => {
    const totals = computeTotals([
      booking({ payment_status: 'paid', convenience_fee: 21 }),
      booking({ payment_status: 'unpaid', convenience_fee: 21 }),
    ]);
    expect(totals.revenue).toBe(21);
  });

  it('computes the repeat-booker rate from per-user booking counts', () => {
    const totals = computeTotals([
      booking({ user_id: 'u1' }),
      booking({ user_id: 'u1' }),
      booking({ user_id: 'u2' }),
    ]);
    expect(totals.repeatRatePct).toBeCloseTo(50);
  });

  it('returns all-zero totals for no bookings, without dividing by zero', () => {
    const totals = computeTotals([]);
    expect(totals.paymentConversionPct).toBe(0);
    expect(totals.repeatRatePct).toBe(0);
  });
});
