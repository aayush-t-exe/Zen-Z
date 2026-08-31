'use client';

import { useEffect, useState } from 'react';
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
}

export default function Dashboard() {
  const router = useRouter();
  const { status, userId } = useAdminGuard();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [founder, setFounder] = useState<string>('');

  useEffect(() => {
    if (status !== 'authorized' || !userId) return;

    const fetchMetrics = async () => {
      try {
        // Get founder name
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', userId)
          .single();

        if (profile) {
          setFounder(profile.full_name);
        }

        // Fetch metrics
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());

        const { data: bookings } = await supabase
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

        const { data: groups } = await supabase
          .from('groups')
          .select('id')
          .eq('status', 'confirmed');

        // Mirrors the matching queue's own pool query (matching/page.tsx,
        // MatchingBoard.tsx) — an unpaid pending_match booking can't
        // actually be matched (confirm_group() requires payment_status =
        // 'paid'), so counting it here as "needs action" is misleading.
        const { data: unmatched } = await supabase
          .from('bookings')
          .select('id')
          .eq('status', 'pending_match')
          .eq('payment_status', 'paid');

        const { data: reports } = await supabase
          .from('reports')
          .select('id')
          .eq('status', 'open');

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
        });
      } catch (error) {
        console.error('Error fetching metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [status, userId]);

  if (status === 'checking' || (status === 'authorized' && loading)) {
    return <AdminAuthLoading />;
  }

  if (status === 'denied' || !metrics) {
    return <AdminAccessDenied />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold">Campus Social</h1>
          <div className="text-right">
            <p className="text-sm text-gray-600">Founder: {founder}</p>
            <Link href="/students" className="text-sm text-blue-600 hover:text-blue-800">
              Students
            </Link>
            {' · '}
            <Link href="/groups" className="text-sm text-blue-600 hover:text-blue-800">
              View groups
            </Link>
            {' · '}
            <Link href="/venues" className="text-sm text-blue-600 hover:text-blue-800">
              Manage venues
            </Link>
            {' · '}
            <Link href="/reports" className="text-sm text-blue-600 hover:text-blue-800">
              Reports
            </Link>
            {' · '}
            <Link href="/referrals" className="text-sm text-blue-600 hover:text-blue-800">
              Referrals
            </Link>
            {' · '}
            <Link href="/analytics" className="text-sm text-blue-600 hover:text-blue-800">
              Analytics
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
