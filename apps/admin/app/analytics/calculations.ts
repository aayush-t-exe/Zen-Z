// Pure bucketing/rate math for the analytics dashboard, extracted out of
// page.tsx's useMemo bodies so it's independently testable. Everything
// here is built from raw booking/no-show/report rows fetched directly
// from Supabase — no server-side aggregation view exists for this yet.

export const ACTIVITY_ORDER = [
  'Cafés',
  'Dinners',
  'Movies',
  'Box Cricket',
  'Football',
  '8-Ball Pool',
  'Pickleball',
];

export interface BookingRow {
  id: string;
  user_id: string;
  status: string;
  payment_status: string;
  created_at: string;
  slot_datetime: string;
  activity_name: string;
  convenience_fee: number;
}

export interface WeekBucket {
  weekLabel: string;
  weekStart: string;
  total: number;
  revenue: number;
  [activity: string]: string | number;
}

export function weekStartOf(dateString: string): Date {
  const d = new Date(dateString);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function weekLabel(d: Date): string {
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

// Last N week-start dates ending on the current week, oldest first — so a
// quiet week still shows as a zero bar/point instead of vanishing.
// `referenceDate` defaults to now; overridable so this is testable without
// mocking global time.
export function lastNWeeks(n: number, referenceDate: Date = new Date()): Date[] {
  const weeks: Date[] = [];
  const current = weekStartOf(referenceDate.toISOString());
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(current);
    d.setDate(d.getDate() - i * 7);
    weeks.push(d);
  }
  return weeks;
}

export function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export function computeWeeklyBookings(
  bookings: BookingRow[],
  activityOrder: string[] = ACTIVITY_ORDER,
  weeksCount = 8,
  referenceDate: Date = new Date()
): WeekBucket[] {
  const weeks = lastNWeeks(weeksCount, referenceDate);
  const buckets: Record<string, WeekBucket> = {};
  weeks.forEach((w) => {
    const key = w.toISOString();
    buckets[key] = { weekLabel: weekLabel(w), weekStart: key, total: 0, revenue: 0 };
    activityOrder.forEach((a) => (buckets[key][a] = 0));
  });

  bookings.forEach((b) => {
    if (!b.slot_datetime) return;
    const key = weekStartOf(b.slot_datetime).toISOString();
    const bucket = buckets[key];
    if (!bucket) return; // outside the last N weeks
    bucket.total = (bucket.total as number) + 1;
    const activity = activityOrder.includes(b.activity_name) ? b.activity_name : 'Other';
    bucket[activity] = ((bucket[activity] as number) ?? 0) + 1;
    if (b.payment_status === 'paid') {
      bucket.revenue = (bucket.revenue as number) + b.convenience_fee;
    }
  });

  return Object.values(buckets).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export interface DayBucket {
  dayLabel: string;
  dayStart: string;
  total: number;
  revenue: number;
  [activity: string]: string | number;
}

export function dayStartOf(dateString: string): Date {
  const d = new Date(dateString);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function dayLabel(d: Date): string {
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

// Last N day-start dates ending today, oldest first — same zero-filling
// rationale as lastNWeeks, just at day granularity.
export function lastNDays(n: number, referenceDate: Date = new Date()): Date[] {
  const days: Date[] = [];
  const current = dayStartOf(referenceDate.toISOString());
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(current);
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  return days;
}

// [ASSUMPTION] docs don't specify a daily-view window, so this mirrors the
// weekly view's ~2-month scope at daily granularity: 14 days keeps a line
// chart readable while still showing a real trend, not just a single spike.
//
// Buckets by created_at (when the booking/payment happened), not
// slot_datetime (the future event date) — unlike computeWeeklyBookings.
// A slot booked today for an event three weeks out should count as
// today's activity, not vanish until the event date rolls around; a
// purely event-date bucketing also made this chart backward-looking-only
// (lastNDays never includes future dates) show nothing for the vast
// majority of real bookings, which are made ahead of their event.
export function computeDailyBookings(
  bookings: BookingRow[],
  activityOrder: string[] = ACTIVITY_ORDER,
  daysCount = 14,
  referenceDate: Date = new Date()
): DayBucket[] {
  const days = lastNDays(daysCount, referenceDate);
  const buckets: Record<string, DayBucket> = {};
  days.forEach((d) => {
    const key = d.toISOString();
    buckets[key] = { dayLabel: dayLabel(d), dayStart: key, total: 0, revenue: 0 };
    activityOrder.forEach((a) => (buckets[key][a] = 0));
  });

  bookings.forEach((b) => {
    if (!b.created_at) return;
    const key = dayStartOf(b.created_at).toISOString();
    const bucket = buckets[key];
    if (!bucket) return; // outside the last N days
    bucket.total = (bucket.total as number) + 1;
    const activity = activityOrder.includes(b.activity_name) ? b.activity_name : 'Other';
    bucket[activity] = ((bucket[activity] as number) ?? 0) + 1;
    if (b.payment_status === 'paid') {
      bucket.revenue = (bucket.revenue as number) + b.convenience_fee;
    }
  });

  return Object.values(buckets).sort((a, b) => a.dayStart.localeCompare(b.dayStart));
}

export interface NoShowWeekBucket {
  weekLabel: string;
  weekStart: string;
  count: number;
}

export function computeNoShowTrend(
  noShowDates: string[],
  weeksCount = 8,
  referenceDate: Date = new Date()
): NoShowWeekBucket[] {
  const weeks = lastNWeeks(weeksCount, referenceDate);
  const buckets: Record<string, NoShowWeekBucket> = {};
  weeks.forEach((w) => {
    const key = w.toISOString();
    buckets[key] = { weekLabel: weekLabel(w), weekStart: key, count: 0 };
  });
  noShowDates.forEach((d) => {
    const key = weekStartOf(d).toISOString();
    if (buckets[key]) buckets[key].count += 1;
  });
  return Object.values(buckets).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export interface SignupWeekBucket {
  weekLabel: string;
  weekStart: string;
  count: number;
}

export function computeWeeklySignups(
  signupDates: string[],
  weeksCount = 8,
  referenceDate: Date = new Date()
): SignupWeekBucket[] {
  const weeks = lastNWeeks(weeksCount, referenceDate);
  const buckets: Record<string, SignupWeekBucket> = {};
  weeks.forEach((w) => {
    const key = w.toISOString();
    buckets[key] = { weekLabel: weekLabel(w), weekStart: key, count: 0 };
  });
  signupDates.forEach((d) => {
    const key = weekStartOf(d).toISOString();
    if (buckets[key]) buckets[key].count += 1;
  });
  return Object.values(buckets).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export interface SignupDayBucket {
  dayLabel: string;
  dayStart: string;
  count: number;
}

export function computeDailySignups(
  signupDates: string[],
  daysCount = 14,
  referenceDate: Date = new Date()
): SignupDayBucket[] {
  const days = lastNDays(daysCount, referenceDate);
  const buckets: Record<string, SignupDayBucket> = {};
  days.forEach((d) => {
    const key = d.toISOString();
    buckets[key] = { dayLabel: dayLabel(d), dayStart: key, count: 0 };
  });
  signupDates.forEach((d) => {
    const key = dayStartOf(d).toISOString();
    if (buckets[key]) buckets[key].count += 1;
  });
  return Object.values(buckets).sort((a, b) => a.dayStart.localeCompare(b.dayStart));
}

export interface Totals {
  totalBookings: number;
  paid: number;
  matched: number;
  revenue: number;
  paymentConversionPct: number;
  repeatRatePct: number;
}

export function computeTotals(bookings: BookingRow[]): Totals {
  const totalBookings = bookings.length;
  const paid = bookings.filter((b) => b.payment_status === 'paid').length;
  const matched = bookings.filter((b) => b.status === 'matched').length;
  const revenue = bookings
    .filter((b) => b.payment_status === 'paid')
    .reduce((sum, b) => sum + b.convenience_fee, 0);

  const byUser: Record<string, number> = {};
  bookings.forEach((b) => {
    byUser[b.user_id] = (byUser[b.user_id] ?? 0) + 1;
  });
  const bookers = Object.keys(byUser).length;
  const repeatBookers = Object.values(byUser).filter((c) => c > 1).length;

  return {
    totalBookings,
    paid,
    matched,
    revenue,
    paymentConversionPct: totalBookings > 0 ? (paid / totalBookings) * 100 : 0,
    repeatRatePct: bookers > 0 ? (repeatBookers / bookers) * 100 : 0,
  };
}
