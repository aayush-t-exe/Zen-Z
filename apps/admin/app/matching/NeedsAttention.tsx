'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatSlotDateTime } from '@/lib/format';

// 2026-09-16: a real student paid, the webhook never flipped
// payment_status, and the founder had no way to see or resolve it —
// "Check Again" on the student's side and the slot-scoped matching board
// on the founder's side both only ever look at bookings that are exactly
// where they're expected to be. This panel surfaces the two ways a
// booking falls outside that: a payment stuck unpaid long enough that
// something's actually wrong (not just "still checking out"), and a paid
// booking whose slot has already passed without ever being matched — the
// matching page's own slot picker (see its `.gt('slot_datetime', ...)`
// query) can structurally never list a past slot, so that booking was
// otherwise permanently unreachable through the normal flow.
const STUCK_PAYMENT_MINUTES = 10;

interface AttentionBooking {
  id: string;
  payment_id: string | null;
  created_at: string;
  profile: { full_name: string; phone: string | null } | null;
  slots: { slot_datetime: string; activity_types: { name: string } | null } | null;
}

const SELECT_FIELDS = `
  id, payment_id, created_at,
  profile:user_id ( full_name, phone ),
  slots:slot_id ( slot_datetime, activity_types:activity_type_id ( name ) )
`;

function describeBooking(b: AttentionBooking): string {
  const activity = b.slots?.activity_types?.name ?? 'Activity';
  const when = b.slots?.slot_datetime ? ` · ${formatSlotDateTime(b.slots.slot_datetime)}` : '';
  const phone = b.profile?.phone ? ` · ${b.profile.phone}` : '';
  return `${activity}${when}${phone}`;
}

export default function NeedsAttention() {
  const [stuckPayments, setStuckPayments] = useState<AttentionBooking[]>([]);
  const [orphaned, setOrphaned] = useState<AttentionBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setError('');
    try {
      const cutoff = new Date(Date.now() - STUCK_PAYMENT_MINUTES * 60 * 1000).toISOString();

      const [stuckResult, pendingResult] = await Promise.all([
        supabase
          .from('bookings')
          .select(SELECT_FIELDS)
          .eq('payment_status', 'unpaid')
          .not('payment_id', 'is', null)
          .neq('status', 'cancelled')
          .lt('created_at', cutoff)
          .order('created_at', { ascending: true }),
        supabase
          .from('bookings')
          .select(SELECT_FIELDS)
          .eq('status', 'pending_match')
          .eq('payment_status', 'paid')
          .order('created_at', { ascending: true }),
      ]);

      if (stuckResult.error || pendingResult.error) {
        setError(stuckResult.error?.message || pendingResult.error?.message || 'Failed to load');
        return;
      }

      setStuckPayments((stuckResult.data as any) ?? []);

      const now = Date.now();
      setOrphaned(
        (((pendingResult.data as any) ?? []) as AttentionBooking[]).filter((b) => {
          const slotTime = b.slots?.slot_datetime ? new Date(b.slots.slot_datetime).getTime() : null;
          return slotTime !== null && slotTime < now;
        })
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const handleMarkPaid = async (booking: AttentionBooking) => {
    if (
      !window.confirm(
        `Mark ${booking.profile?.full_name ?? 'this booking'}'s payment as paid?\n\n` +
          `PayU ref: ${booking.payment_id}\n\n` +
          `Only confirm this after checking the transaction actually succeeded in the PayU dashboard — ` +
          `this cannot check that itself.`
      )
    ) {
      return;
    }
    setActingId(booking.id);
    try {
      const { error: rpcError } = await supabase.rpc('admin_mark_booking_paid', {
        p_booking_id: booking.id,
      });
      if (rpcError) throw rpcError;
      setStuckPayments((prev) => prev.filter((b) => b.id !== booking.id));
    } catch (err: any) {
      alert(err?.message || 'Failed to mark this booking paid.');
    } finally {
      setActingId(null);
    }
  };

  const handleCancel = async (booking: AttentionBooking, from: 'stuck' | 'orphaned') => {
    if (!window.confirm(`Cancel ${booking.profile?.full_name ?? 'this'}'s booking? This can't be undone.`)) {
      return;
    }
    setActingId(booking.id);
    try {
      const { error: rpcError } = await supabase.rpc('admin_cancel_booking', { p_booking_id: booking.id });
      if (rpcError) throw rpcError;
      if (from === 'stuck') setStuckPayments((prev) => prev.filter((b) => b.id !== booking.id));
      else setOrphaned((prev) => prev.filter((b) => b.id !== booking.id));
    } catch (err: any) {
      alert(err?.message || 'Failed to cancel this booking.');
    } finally {
      setActingId(null);
    }
  };

  // Loading and "nothing to show" both render nothing — this panel sits
  // above the always-present activity/slot picker, so it should never
  // hold up or clutter that with its own spinner when there's nothing to
  // report.
  if (loading || (!error && stuckPayments.length === 0 && orphaned.length === 0)) {
    return null;
  }

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-8">
      <h2 className="font-bold text-orange-900 mb-1">Needs your attention</h2>
      <p className="text-sm text-orange-800 mb-4">
        Not tied to whichever activity/slot is selected below — these need a direct decision.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          Couldn&apos;t check for bookings needing attention: {error}
        </div>
      )}

      {stuckPayments.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Payment stuck unpaid, {STUCK_PAYMENT_MINUTES}+ minutes ({stuckPayments.length})
          </h3>
          <div className="space-y-2">
            {stuckPayments.map((b) => (
              <div key={b.id} className="bg-white rounded border p-3 flex items-center justify-between gap-4">
                <div className="text-sm">
                  <p className="font-medium">{b.profile?.full_name ?? 'Unknown student'}</p>
                  <p className="text-gray-500">{describeBooking(b)}</p>
                  <p className="text-gray-400 text-xs mt-0.5">PayU ref: {b.payment_id}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleMarkPaid(b)}
                    disabled={actingId === b.id}
                    className="px-3 py-1.5 rounded bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50"
                  >
                    Mark as Paid
                  </button>
                  <button
                    onClick={() => handleCancel(b, 'stuck')}
                    disabled={actingId === b.id}
                    className="px-3 py-1.5 rounded bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {orphaned.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Paid but never matched — slot already passed ({orphaned.length})
          </h3>
          <div className="space-y-2">
            {orphaned.map((b) => (
              <div key={b.id} className="bg-white rounded border p-3 flex items-center justify-between gap-4">
                <div className="text-sm">
                  <p className="font-medium">{b.profile?.full_name ?? 'Unknown student'}</p>
                  <p className="text-gray-500">{describeBooking(b)}</p>
                </div>
                <button
                  onClick={() => handleCancel(b, 'orphaned')}
                  disabled={actingId === b.id}
                  className="px-3 py-1.5 rounded bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200 disabled:opacity-50 shrink-0"
                >
                  Cancel (refund manually via PayU)
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
