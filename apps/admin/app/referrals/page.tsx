'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminGuard, AdminAccessDenied, AdminAuthLoading } from '@/lib/adminAuth';
import Link from 'next/link';

interface Redemption {
  id: string;
  redeemed_at: string;
  code: string;
  owner: { id: string; full_name: string } | null;
  referred: { id: string; full_name: string } | null;
  creditStatus: 'available' | 'consumed' | null;
}

export default function ReferralsPage() {
  const { status } = useAdminGuard();
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status !== 'authorized') return;

    const load = async () => {
      setLoading(true);
      setError('');

      const [{ data: redemptionRows, error: redemptionError }, { data: creditRows, error: creditsError }] = await Promise.all([
        supabase
          .from('referral_redemptions')
          .select(
            `id, redeemed_at, code,
             referrals:code ( owner:owner_id ( id, full_name ) ),
             referred:referred_user_id ( id, full_name )`
          )
          .order('redeemed_at', { ascending: false }),
        supabase.from('referral_credits').select('redemption_id, status'),
      ]);

      if (redemptionError || creditsError) {
        console.error('Error loading referrals:', redemptionError ?? creditsError);
        setError('Failed to load referrals');
        setLoading(false);
        return;
      }

      const creditByRedemption = new Map(
        (creditRows ?? []).map((c: any) => [c.redemption_id, c.status as 'available' | 'consumed'])
      );

      setRedemptions(
        (redemptionRows ?? []).map((r: any) => ({
          id: r.id,
          redeemed_at: r.redeemed_at,
          code: r.code,
          owner: r.referrals?.owner ?? null,
          referred: r.referred,
          creditStatus: creditByRedemption.get(r.id) ?? null,
        }))
      );

      setLoading(false);
    };

    load();
  }, [status]);

  if (status === 'checking' || (status === 'authorized' && loading)) {
    return <AdminAuthLoading />;
  }

  if (status === 'denied') {
    return <AdminAccessDenied />;
  }

  const availableCount = redemptions.filter((r) => r.creditStatus === 'available').length;
  const consumedCount = redemptions.filter((r) => r.creditStatus === 'consumed').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-blue-600 hover:text-blue-800">
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-bold">Referrals</h1>
          </div>
          <Link href="/analytics" className="text-sm text-blue-600 hover:text-blue-800">
            Analytics →
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">{error}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg border p-6">
            <p className="text-gray-600 text-sm font-medium">Friends who stepped in</p>
            <p className="text-4xl font-bold mt-2">{redemptions.length}</p>
          </div>
          <div className="bg-white rounded-lg border p-6">
            <p className="text-gray-600 text-sm font-medium">₹21 credits waiting</p>
            <p className="text-4xl font-bold mt-2">{availableCount}</p>
          </div>
          <div className="bg-white rounded-lg border p-6">
            <p className="text-gray-600 text-sm font-medium">₹21 credits redeemed</p>
            <p className="text-4xl font-bold mt-2">{consumedCount}</p>
          </div>
        </div>

        <section>
          <h2 className="text-lg font-semibold mb-4">History ({redemptions.length})</h2>
          {redemptions.length === 0 ? (
            <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
              No referral redemptions yet.
            </div>
          ) : (
            <div className="space-y-3">
              {redemptions.map((r) => (
                <div key={r.id} className="bg-white rounded-lg border p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{r.owner?.full_name ?? 'Unknown'}</span> invited{' '}
                      <span className="font-medium">{r.referred?.full_name ?? 'Unknown'}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Code {r.code} · {new Date(r.redeemed_at).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${
                      r.creditStatus === 'consumed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {r.creditStatus === 'consumed' ? 'Redeemed' : 'Available'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
