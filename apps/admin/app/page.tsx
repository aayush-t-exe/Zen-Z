'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAdminGuard, AdminAccessDenied, AdminAuthLoading } from '@/lib/adminAuth';
import Link from 'next/link';

interface DashboardMetrics {
  bookings_this_week: number;
  cafe_bookings: number;
  dinner_bookings: number;
  movie_bookings: number;
  sports_bookings: number;
  groups_formed: number;
  unmatched_count: number;
  pending_reports: number;
  stuck_payments_count: number;
}

// A payment link takes at most a couple of minutes to complete and have
// its webhook land — 10 minutes past that with a payment attempt on
// record and no 'paid' status is a real stuck payment, not just a student
// still on the PayU checkout page. Mirrors NeedsAttention.tsx's own
// query (matching/page.tsx) — kept in sync by hand since this is a plain
// client component, not shared server-side logic.
const STUCK_PAYMENT_MINUTES = 10;

export default function Dashboard() {
  const router = useRouter();
  const { status, userId } = useAdminGuard();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [founder, setFounder] = useState<string>('');
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async (uid: string) => {
      try {
        setLoading(true);
        setMetricsError(null);

        // Get founder name
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', uid)
          .single();

        if (profile) {
          setFounder(profile.full_name);
        }

        // Fetch metrics
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());

        const { data: bookings, error: bookingsError } = await supabase
          .from('bookings')
          .select(`
            id,
            slots:slot_id (
              activity_types:activity_type_id (
                name,
                parent_activity_id
              )
            )
          `)
          .gte('created_at', weekStart.toISOString())
          .lte('created_at', today.toISOString())
          .eq('payment_status', 'paid');

        const { data: groups, error: groupsError } = await supabase
          .from('groups')
          .select('id')
          .eq('status', 'confirmed');

        // Mirrors the matching queue's own pool query (matching/page.tsx,
        // MatchingBoard.tsx) — an unpaid pending_match booking can't
        // actually be matched (confirm_group() requires payment_status =
        // 'paid'), so counting it here as "needs action" is misleading.
        const { data: unmatched, error: unmatchedError } = await supabase
          .from('bookings')
          .select('id')
          .eq('status', 'pending_match')
          .eq('payment_status', 'paid');

        const { data: reports, error: reportsError } = await supabase
          .from('reports')
          .select('id')
          .eq('status', 'open');

        // Same "why is this invisible" gap that surfaced the 2026-09-16
        // incident: a payment that never got its webhook used to have no
        // signal anywhere until a student complained. See NeedsAttention.tsx
        // (matching/page.tsx) for the matching-page panel this count links to.
        const stuckPaymentCutoff = new Date(Date.now() - STUCK_PAYMENT_MINUTES * 60 * 1000).toISOString();
        const { data: stuckPayments, error: stuckPaymentsError } = await supabase
          .from('bookings')
          .select('id')
          .eq('payment_status', 'unpaid')
          .not('payment_id', 'is', null)
          .neq('status', 'cancelled')
          .lt('created_at', stuckPaymentCutoff);

        // A failed query here must not present as "0 unmatched, 0 pending
        // reports" — that reads as "nothing needs your attention" when it
        // actually means the dashboard couldn't check.
        const metricsFetchError =
          bookingsError || groupsError || unmatchedError || reportsError || stuckPaymentsError;
        if (metricsFetchError) {
          setMetricsError(metricsFetchError.message);
          return;
        }

        let cafe = 0, dinner = 0, movie = 0, sports = 0;
        bookings?.forEach((b: any) => {
          const activityType = b.slots?.activity_types;
          const activity = activityType?.name;
          if (activity === 'Cafés') cafe++;
          else if (activity === 'Dinners') dinner++;
          else if (activity === 'Movies') movie++;
          else if (activityType?.parent_activity_id != null) sports++;
        });

        setMetrics({
          bookings_this_week: bookings?.length || 0,
          cafe_bookings: cafe,
          dinner_bookings: dinner,
          movie_bookings: movie,
          sports_bookings: sports,
          groups_formed: groups?.length || 0,
          unmatched_count: unmatched?.length || 0,
          pending_reports: reports?.length || 0,
          stuck_payments_count: stuckPayments?.length || 0,
        });
      } catch (error) {
        console.error('Error fetching metrics:', error);
        setMetricsError(error instanceof Error ? error.message : 'Failed to load dashboard metrics');
      } finally {
        setLoading(false);
      }
  }, []);

  useEffect(() => {
    if (status !== 'authorized' || !userId) return;
    fetchMetrics(userId);
  }, [status, userId, fetchMetrics]);

  if (status === 'checking' || (status === 'authorized' && loading)) {
    return <AdminAuthLoading />;
  }

  if (status === 'denied') {
    return <AdminAccessDenied />;
  }

  if (metricsError || !metrics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-bold mb-2">Couldn&apos;t load the dashboard</h1>
          <p className="text-gray-600 mb-4">{metricsError ?? 'Something went wrong.'}</p>
          <button
            onClick={() => userId && fetchMetrics(userId)}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold">Campus Social</h1>
          <div className="text-right">
            <p className="text-sm text-gray-600">Founder: {founder}</p>
            <Link href="/venues" className="text-sm text-blue-600 hover:text-blue-800">
              Manage venues
            </Link>
            {' · '}
            <Link href="/movies" className="text-sm text-blue-600 hover:text-blue-800">
              Manage movies
            </Link>
            {' · '}
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.push('/login');
              }}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Date header */}
        <div className="mb-8">
          <p className="text-gray-600">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Bookings this week */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Bookings this week</p>
                <p className="text-4xl font-bold mt-2">{metrics.bookings_this_week}</p>
              </div>
              <span className="text-3xl">📋</span>
            </div>
            <div className="mt-4 text-sm text-gray-600 space-y-1">
              <p>☕ Cafés: {metrics.cafe_bookings}</p>
              <p>🍽 Dinners: {metrics.dinner_bookings}</p>
              <p>🎬 Movies: {metrics.movie_bookings}</p>
              <p>🏆 Sports: {metrics.sports_bookings}</p>
            </div>
          </div>

          {/* Groups formed */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Groups formed</p>
                <p className="text-4xl font-bold mt-2">{metrics.groups_formed}</p>
              </div>
              <span className="text-3xl">✅</span>
            </div>
            <p className="text-sm text-gray-500 mt-4">Confirmed groups ready to meet</p>
            <Link
              href="/groups"
              className="text-sm text-blue-600 hover:text-blue-800 mt-2 block"
            >
              View groups →
            </Link>
          </div>

          {/* Unmatched bookings */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Unmatched (need action)</p>
                <p className="text-4xl font-bold mt-2 text-orange-600">{metrics.unmatched_count}</p>
              </div>
              <span className="text-3xl">⚠️</span>
            </div>
            <Link
              href="/matching"
              className="text-sm text-blue-600 hover:text-blue-800 mt-4 block"
            >
              Go to matching queue →
            </Link>
          </div>

          {/* Pending reports */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Pending reports</p>
                <p className="text-4xl font-bold mt-2 text-red-600">{metrics.pending_reports}</p>
              </div>
              <span className="text-3xl">🚩</span>
            </div>
            <Link
              href="/reports"
              className="text-sm text-blue-600 hover:text-blue-800 mt-4 block"
            >
              Review reports →
            </Link>
          </div>

          {/* Stuck payments */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Payments to check</p>
                <p className="text-4xl font-bold mt-2 text-orange-600">{metrics.stuck_payments_count}</p>
              </div>
              <span className="text-3xl">💳</span>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Unpaid {STUCK_PAYMENT_MINUTES}+ min after a payment attempt
            </p>
            <Link
              href="/matching"
              className="text-sm text-blue-600 hover:text-blue-800 mt-2 block"
            >
              Review →
            </Link>
          </div>
        </div>

        {/* Manage */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Manage</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Link
              href="/students"
              className="bg-white rounded-lg border p-6 block hover:border-gray-400 transition-colors"
            >
              <span className="text-3xl">🧑‍🎓</span>
              <p className="font-semibold mt-3">Students</p>
              <p className="text-sm text-gray-500 mt-1">Browse and search every student profile</p>
            </Link>

            <Link
              href="/reports"
              className="bg-white rounded-lg border p-6 block hover:border-gray-400 transition-colors"
            >
              <span className="text-3xl">🚩</span>
              <p className="font-semibold mt-3">Reports</p>
              <p className="text-sm text-gray-500 mt-1">Review open and past safety reports</p>
            </Link>

            <Link
              href="/referrals"
              className="bg-white rounded-lg border p-6 block hover:border-gray-400 transition-colors"
            >
              <span className="text-3xl">🎁</span>
              <p className="font-semibold mt-3">Referrals</p>
              <p className="text-sm text-gray-500 mt-1">Track redemptions and referral credits</p>
            </Link>

            <Link
              href="/feedback"
              className="bg-white rounded-lg border p-6 block hover:border-gray-400 transition-colors"
            >
              <span className="text-3xl">💬</span>
              <p className="font-semibold mt-3">Feedback</p>
              <p className="text-sm text-gray-500 mt-1">See how past meetups went, straight from students</p>
            </Link>

            <Link
              href="/analytics"
              className="bg-white rounded-lg border p-6 block hover:border-gray-400 transition-colors"
            >
              <span className="text-3xl">📊</span>
              <p className="font-semibold mt-3">Analytics</p>
              <p className="text-sm text-gray-500 mt-1">Bookings, revenue, and funnel trends</p>
            </Link>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-white rounded-lg border p-8 text-center">
          <h2 className="text-2xl font-bold mb-2">Ready to match?</h2>
          <p className="text-gray-600 mb-6">
            {metrics.unmatched_count} students are waiting for their group
          </p>
          <Link
            href="/matching"
            className="inline-block bg-gray-900 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-800"
          >
            Go to Matching Queue →
          </Link>
        </div>
      </main>
    </div>
  );
}
