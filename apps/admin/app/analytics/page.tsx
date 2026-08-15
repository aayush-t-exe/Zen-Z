'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { useAdminGuard, AdminAccessDenied, AdminAuthLoading } from '@/lib/adminAuth';
import Link from 'next/link';

// Fixed categorical order (never cycled) — Café / Dinner / Movie, matching
// CLAUDE.md's canonical activity order. Validated all-pairs at light-surface
// #ffffff (worst CVD ΔE 9.2, worst normal-vision ΔE 24.0) via the dataviz
// skill's palette. Aqua (Movies) sits below 3:1 contrast on white, so it
// always ships with a visible legend/direct label, never color alone.
const ACTIVITY_COLORS: Record<string, string> = {
  'Cafés': '#2a78d6',
  Dinners: '#eb6834',
  Movies: '#1baf7a',
};
const ACTIVITY_ORDER = ['Cafés', 'Dinners', 'Movies'];
const FALLBACK_COLOR = '#898781';

// Sequential single-hue ramp (blue), for magnitude-over-time and the
// ordinal funnel. Ordinal steps (250/400/550) validated monotone with
// visible step gaps and the light end clearing 2:1 against white.
const REVENUE_COLOR = '#2a78d6';
const FUNNEL_STEPS = ['#86b6ef', '#3987e5', '#1c5cab'];

// Fixed status palette (never themed, never reused for series identity).
const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
  muted: '#898781',
};

const GRID_COLOR = '#e5e7eb'; // matches this app's existing border-gray-200
const AXIS_COLOR = '#6b7280'; // matches existing text-gray-500

interface BookingRow {
  id: string;
  user_id: string;
  status: string;
  payment_status: string;
  slot_datetime: string;
  activity_name: string;
  convenience_fee: number;
}

interface WeekBucket {
  weekLabel: string;
  weekStart: string;
  total: number;
  revenue: number;
  [activity: string]: string | number;
}

function weekStartOf(dateString: string): Date {
  const d = new Date(dateString);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function weekLabel(d: Date): string {
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

// Last N week-start dates ending on the current week, oldest first — so a
// quiet week still shows as a zero bar/point instead of vanishing.
function lastNWeeks(n: number): Date[] {
  const weeks: Date[] = [];
  const current = weekStartOf(new Date().toISOString());
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(current);
    d.setDate(d.getDate() - i * 7);
    weeks.push(d);
  }
  return weeks;
}

function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

function CustomTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-xs">
      <p className="font-semibold text-gray-900 mb-1">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} className="flex items-center gap-1.5 text-gray-600">
          <span
            className="inline-block w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}: <span className="font-medium text-gray-900">{formatter ? formatter(entry.value) : entry.value}</span>
        </p>
      ))}
    </div>
  );
}

function Meter({ label, percent, color }: { label: string; percent: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="bg-white rounded-lg border p-6">
      <p className="text-gray-600 text-sm font-medium mb-3">{label}</p>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-3 rounded-full" style={{ backgroundColor: `${color}22` }}>
          <div
            className="h-3 rounded-full transition-all"
            style={{ width: `${clamped}%`, backgroundColor: color }}
          />
        </div>
        <span className="text-lg font-bold text-gray-900 shrink-0">{clamped.toFixed(0)}%</span>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { status } = useAdminGuard();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [noShowDates, setNoShowDates] = useState<string[]>([]);
  const [reportCounts, setReportCounts] = useState({ open: 0, resolved: 0, dismissed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status !== 'authorized') return;

    const load = async () => {
      setLoading(true);
      setError('');

      const [{ data: bookingsData, error: bookingsError }, { data: noShows }, { data: reports }] =
        await Promise.all([
          supabase
            .from('bookings')
            .select(
              `id, user_id, status, payment_status,
               slots:slot_id ( slot_datetime, activity_types:activity_type_id ( name, convenience_fee ) )`
            ),
          supabase.from('no_shows').select('created_at'),
          supabase.from('reports').select('status'),
        ]);

      if (bookingsError) {
        console.error('Error loading analytics:', bookingsError);
        setError('Failed to load analytics');
        setLoading(false);
        return;
      }

      setBookings(
        (bookingsData ?? []).map((b: any) => ({
          id: b.id,
          user_id: b.user_id,
          status: b.status,
          payment_status: b.payment_status,
          slot_datetime: b.slots?.slot_datetime,
          activity_name: b.slots?.activity_types?.name ?? 'Unknown',
          // [ASSUMPTION] convenience_fee is only stored on activity_types,
          // not snapshotted per booking, so a booking made before a fee
          // change (0015: ₹9 → ₹21) is counted here at today's rate, not
          // what was actually charged at the time. Acceptable approximation
          // at this scale; would need a booking-level price snapshot to fix.
          convenience_fee: b.slots?.activity_types?.convenience_fee ?? 0,
        }))
      );
      setNoShowDates((noShows ?? []).map((n: any) => n.created_at));
      setReportCounts({
        open: (reports ?? []).filter((r: any) => r.status === 'open').length,
        resolved: (reports ?? []).filter((r: any) => r.status === 'resolved').length,
        dismissed: (reports ?? []).filter((r: any) => r.status === 'dismissed').length,
      });

      setLoading(false);
    };

    load();
  }, [status]);

  const weeklyBookings: WeekBucket[] = useMemo(() => {
    const weeks = lastNWeeks(8);
    const buckets: Record<string, WeekBucket> = {};
    weeks.forEach((w) => {
      const key = w.toISOString();
      buckets[key] = { weekLabel: weekLabel(w), weekStart: key, total: 0, revenue: 0 };
      ACTIVITY_ORDER.forEach((a) => (buckets[key][a] = 0));
    });

    bookings.forEach((b) => {
      if (!b.slot_datetime) return;
      const key = weekStartOf(b.slot_datetime).toISOString();
      const bucket = buckets[key];
      if (!bucket) return; // outside the last 8 weeks
      bucket.total = (bucket.total as number) + 1;
      const activity = ACTIVITY_ORDER.includes(b.activity_name) ? b.activity_name : 'Other';
      bucket[activity] = ((bucket[activity] as number) ?? 0) + 1;
      if (b.payment_status === 'paid') {
        bucket.revenue = (bucket.revenue as number) + b.convenience_fee;
      }
    });

    return Object.values(buckets).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  }, [bookings]);

  const noShowTrend = useMemo(() => {
    const weeks = lastNWeeks(8);
    const buckets: Record<string, { weekLabel: string; weekStart: string; count: number }> = {};
    weeks.forEach((w) => {
      const key = w.toISOString();
      buckets[key] = { weekLabel: weekLabel(w), weekStart: key, count: 0 };
    });
    noShowDates.forEach((d) => {
      const key = weekStartOf(d).toISOString();
      if (buckets[key]) buckets[key].count += 1;
    });
    return Object.values(buckets).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  }, [noShowDates]);

  const totals = useMemo(() => {
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
  }, [bookings]);

  if (status === 'checking' || (status === 'authorized' && loading)) {
    return <AdminAuthLoading />;
  }

  if (status === 'denied') {
    return <AdminAccessDenied />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-blue-600 hover:text-blue-800">
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-bold">Analytics</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* KPI row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg border p-6">
            <p className="text-gray-600 text-sm font-medium">Total bookings</p>
            <p className="text-4xl font-bold mt-2">{totals.totalBookings.toLocaleString('en-IN')}</p>
            <p className="text-sm text-gray-500 mt-4">All-time, every activity</p>
          </div>
          <div className="bg-white rounded-lg border p-6">
            <p className="text-gray-600 text-sm font-medium">Total revenue</p>
            <p className="text-4xl font-bold mt-2">{formatINR(totals.revenue)}</p>
            <p className="text-sm text-gray-500 mt-4">Convenience fee, paid bookings</p>
          </div>
          <Meter label="Payment conversion" percent={totals.paymentConversionPct} color={STATUS.good} />
          <Meter label="Repeat booking rate" percent={totals.repeatRatePct} color={REVENUE_COLOR} />
        </div>

        {/* Booking funnel */}
        <div className="bg-white rounded-lg border p-6 mb-8">
          <h2 className="font-bold mb-1">Booking funnel</h2>
          <p className="text-sm text-gray-500 mb-4">All-time — where bookings drop off before a group forms.</p>
          <div className="space-y-3">
            {[
              { label: 'Booked', value: totals.totalBookings, color: FUNNEL_STEPS[0] },
              { label: 'Paid', value: totals.paid, color: FUNNEL_STEPS[1] },
              { label: 'Matched', value: totals.matched, color: FUNNEL_STEPS[2] },
            ].map((stage) => {
              const pct = totals.totalBookings > 0 ? (stage.value / totals.totalBookings) * 100 : 0;
              return (
                <div key={stage.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-900">{stage.label}</span>
                    <span className="text-gray-500">
                      {stage.value.toLocaleString('en-IN')} ({pct.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-gray-100">
                    <div
                      className="h-3 rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: stage.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekly bookings by activity */}
        <div className="bg-white rounded-lg border p-6 mb-8">
          <h2 className="font-bold mb-1">Bookings by week</h2>
          <p className="text-sm text-gray-500 mb-4">Last 8 weeks, by event date and activity.</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={weeklyBookings} margin={{ left: -10 }}>
              <CartesianGrid vertical={false} stroke={GRID_COLOR} />
              <XAxis dataKey="weekLabel" stroke={AXIS_COLOR} fontSize={12} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
              <YAxis stroke={AXIS_COLOR} fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f3f4f6' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
              {ACTIVITY_ORDER.map((activity) => (
                <Bar
                  key={activity}
                  dataKey={activity}
                  name={activity}
                  stackId="bookings"
                  fill={ACTIVITY_COLORS[activity] ?? FALLBACK_COLOR}
                  radius={[0, 0, 0, 0]}
                  maxBarSize={28}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly revenue */}
        <div className="bg-white rounded-lg border p-6 mb-8">
          <h2 className="font-bold mb-1">Revenue by week</h2>
          <p className="text-sm text-gray-500 mb-4">Convenience fee collected on paid bookings.</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={weeklyBookings} margin={{ left: -10 }}>
              <CartesianGrid vertical={false} stroke={GRID_COLOR} />
              <XAxis dataKey="weekLabel" stroke={AXIS_COLOR} fontSize={12} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
              <YAxis stroke={AXIS_COLOR} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
              <Tooltip content={<CustomTooltip formatter={formatINR} />} cursor={{ fill: '#f3f4f6' }} />
              <Bar dataKey="revenue" name="Revenue" fill={REVENUE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* No-show trend */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="font-bold mb-1">⚠️ No-shows by week</h2>
            <p className="text-sm text-gray-500 mb-4">Marked manually by the founder — reflects what's been recorded.</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={noShowTrend} margin={{ left: -10, right: 12, top: 8 }}>
                <CartesianGrid vertical={false} stroke={GRID_COLOR} />
                <XAxis
                  dataKey="weekLabel"
                  stroke={AXIS_COLOR}
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: GRID_COLOR }}
                />
                <YAxis stroke={AXIS_COLOR} fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="No-shows"
                  stroke={STATUS.serious}
                  strokeWidth={2}
                  dot={{ r: 4, fill: STATUS.serious }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Reports snapshot */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold">🚩 Reports</h2>
              <Link href="/reports" className="text-sm text-blue-600 hover:text-blue-800">
                Review reports →
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">
                  <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: STATUS.critical }} />
                  Open
                </p>
                <p className="text-3xl font-bold" style={{ color: STATUS.critical }}>
                  {reportCounts.open}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">
                  <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: STATUS.good }} />
                  Resolved
                </p>
                <p className="text-3xl font-bold" style={{ color: STATUS.good }}>
                  {reportCounts.resolved}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">
                  <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: STATUS.muted }} />
                  Dismissed
                </p>
                <p className="text-3xl font-bold" style={{ color: STATUS.muted }}>
                  {reportCounts.dismissed}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
