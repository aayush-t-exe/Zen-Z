'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminGuard, AdminAccessDenied, AdminAuthLoading } from '@/lib/adminAuth';
import { getSignedPhotoUrls } from '@/lib/photos';
import { formatBudget, formatSlotDateTime } from '@/lib/format';
import Link from 'next/link';

interface Member {
  id: string;
  booking_id: string;
  full_name: string;
  gender: string | null;
  year_of_study: number;
  photo_url: string | null;
  budget_band: string;
  group_preference: string;
  plus_one: boolean;
  plus_one_name: string | null;
}

interface Group {
  id: string;
  created_at: string;
  slot_id: string;
  slot_datetime: string;
  activity_name: string;
  activity_emoji: string;
  max_group_size: number;
  venue_name: string | null;
  reveal_venue_at: string;
  members: Member[];
}

interface Candidate {
  booking_id: string;
  slot_id: string;
  full_name: string;
  gender: string | null;
  year_of_study: number;
  photo_url: string | null;
  budget_band: string;
  group_preference: string;
  plus_one: boolean;
  plus_one_name: string | null;
  profile_id: string;
}

export default function GroupsPage() {
  const { status } = useAdminGuard();
  const [groups, setGroups] = useState<Group[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Record<string, string>>({});
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'authorized') return;

    const loadGroups = async () => {
      setLoading(true);
      setError('');

      const [{ data, error: fetchError }, { data: candidateBookings, error: candidatesError }] = await Promise.all([
        supabase
          .from('groups')
          .select(
            `id, created_at, slot_id,
             slots:slot_id ( slot_datetime, reveal_venue_at, activity_types:activity_type_id ( name, emoji, max_group_size ) ),
             venues:venue_id ( name ),
             group_members (
               bookings:booking_id (
                 id, budget_band, group_preference, plus_one, plus_one_name,
                 profile:user_id ( id, full_name, gender, year_of_study, photo_url )
               )
             )`
          )
          .eq('status', 'confirmed')
          .order('created_at', { ascending: false }),
        // The pool of students an existing group can be topped up from —
        // same shape as the matching board's unmatched pool (0017's
        // confirm_group payment gate applies the same way here).
        supabase
          .from('bookings')
          .select(
            `id, slot_id, budget_band, group_preference, plus_one, plus_one_name,
             profile:user_id ( id, full_name, gender, year_of_study, photo_url )`
          )
          .eq('status', 'pending_match')
          .eq('payment_status', 'paid'),
      ]);

      if (fetchError) {
        console.error('Error loading groups:', fetchError);
        setError('Failed to load groups');
        setLoading(false);
        return;
      }

      // A failed fetch here must not read as "no one available to fill an
      // open seat" — the founder would think the candidate pool is
      // genuinely empty rather than that the query failed.
      if (candidatesError) {
        console.error('Error loading fill-seat candidates:', candidatesError);
        setError('Failed to load the list of students available to fill an open seat');
        setLoading(false);
        return;
      }

      const mapped: Group[] = (data ?? []).map((g: any) => ({
        id: g.id,
        created_at: g.created_at,
        slot_id: g.slot_id,
        slot_datetime: g.slots?.slot_datetime,
        reveal_venue_at: g.slots?.reveal_venue_at,
        activity_name: g.slots?.activity_types?.name ?? 'Unknown',
        activity_emoji: g.slots?.activity_types?.emoji ?? '',
        max_group_size: g.slots?.activity_types?.max_group_size ?? Infinity,
        venue_name: g.venues?.name ?? null,
        members: (g.group_members ?? [])
          .map((gm: any) => gm.bookings)
          .filter(Boolean)
          .map((b: any) => ({
            id: b.profile.id,
            booking_id: b.id,
            full_name: b.profile.full_name,
            gender: b.profile.gender,
            year_of_study: b.profile.year_of_study,
            photo_url: b.profile.photo_url,
            budget_band: b.budget_band,
            group_preference: b.group_preference,
            plus_one: b.plus_one,
            plus_one_name: b.plus_one_name,
          })),
      }));

      setGroups(mapped);

      const candidateList: Candidate[] = (candidateBookings ?? []).map((b: any) => ({
        booking_id: b.id,
        slot_id: b.slot_id,
        full_name: b.profile.full_name,
        gender: b.profile.gender,
        year_of_study: b.profile.year_of_study,
        photo_url: b.profile.photo_url,
        budget_band: b.budget_band,
        group_preference: b.group_preference,
        plus_one: b.plus_one,
        plus_one_name: b.plus_one_name,
        profile_id: b.profile.id,
      }));
      setCandidates(candidateList);

      const members = mapped
        .flatMap((g) => g.members.map((m) => ({ id: m.id, hasPhoto: !!m.photo_url })))
        .concat(candidateList.map((c) => ({ id: c.profile_id, hasPhoto: !!c.photo_url })));
      getSignedPhotoUrls(members).then(setPhotoUrls);

      setLoading(false);
    };

    loadGroups();
  }, [status]);

  // admin_cancel_booking() (0070) deletes the group_members row outright
  // (not a left_at-archive like the student's own self-service leave
  // flow) and queues a group_member_left notification for whoever's left
  // — so removing this member from local state here just mirrors what
  // already happened server-side, not a separate optimistic guess.
  const handleCancelMember = async (groupId: string, member: Member) => {
    if (!window.confirm(`Cancel ${member.full_name}'s booking and remove them from this group? This can't be undone.`)) {
      return;
    }

    setCancellingId(member.booking_id);
    setError('');
    try {
      const { error: cancelError } = await supabase.rpc('admin_cancel_booking', {
        p_booking_id: member.booking_id,
      });
      if (cancelError) throw cancelError;

      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId ? { ...g, members: g.members.filter((m) => m.booking_id !== member.booking_id) } : g
        )
      );
    } catch (err: any) {
      console.error('Error cancelling booking:', err);
      setError(err?.message || 'Failed to cancel this booking. Please try again.');
    } finally {
      setCancellingId(null);
    }
  };

  // admin_add_group_member() (0071) enforces the same hard gates a fresh
  // confirm_group() call would (gender preference, reporter/reported
  // blocklist, max_group_size) server-side — this can still fail even
  // though the candidate list is pre-filtered to the right slot, so the
  // error message from the RPC (not a generic one) is what gets shown.
  const handleAddMember = async (group: Group) => {
    const bookingId = selectedCandidate[group.id];
    if (!bookingId) return;
    const candidate = candidates.find((c) => c.booking_id === bookingId);
    if (!candidate) return;

    setAddingId(group.id);
    setError('');
    try {
      const { error: addError } = await supabase.rpc('admin_add_group_member', {
        p_group_id: group.id,
        p_booking_id: bookingId,
      });
      if (addError) throw addError;

      setGroups((prev) =>
        prev.map((g) =>
          g.id === group.id
            ? {
                ...g,
                members: [
                  ...g.members,
                  {
                    id: candidate.profile_id,
                    booking_id: candidate.booking_id,
                    full_name: candidate.full_name,
                    gender: candidate.gender,
                    year_of_study: candidate.year_of_study,
                    photo_url: candidate.photo_url,
                    budget_band: candidate.budget_band,
                    group_preference: candidate.group_preference,
                    plus_one: candidate.plus_one,
                    plus_one_name: candidate.plus_one_name,
                  },
                ],
              }
            : g
        )
      );
      setCandidates((prev) => prev.filter((c) => c.booking_id !== bookingId));
      setSelectedCandidate((prev) => {
        const next = { ...prev };
        delete next[group.id];
        return next;
      });
    } catch (err: any) {
      console.error('Error adding group member:', err);
      setError(err?.message || 'Failed to add this student to the group. Please try again.');
    } finally {
      setAddingId(null);
    }
  };

  if (status === 'checking') {
    return <AdminAuthLoading />;
  }

  if (status === 'denied') {
    return <AdminAccessDenied />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-blue-600 hover:text-blue-800">
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-bold">Groups</h1>
          </div>
          <Link href="/matching" className="text-sm text-blue-600 hover:text-blue-800">
            Go to Matching Queue →
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          </div>
        ) : groups.length === 0 ? (
          <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
            No groups confirmed yet — head to the matching queue to form one.
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => {
              const isRevealed = new Date(group.reveal_venue_at) <= new Date();
              return (
                <div key={group.id} className="bg-white rounded-lg border p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-semibold text-lg">
                        {group.activity_emoji} {group.activity_name}
                      </p>
                      <p className="text-sm text-gray-600">
                        {formatSlotDateTime(group.slot_datetime)}
                        {group.venue_name && ` · ${group.venue_name}`}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${
                        isRevealed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {isRevealed ? 'Venue & chat revealed' : 'Revealed 48h before event'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {group.members.map((member) => (
                      <div key={member.id} className="flex items-center gap-3 border rounded-lg p-3">
                        {photoUrls[member.id] ? (
                          <img
                            src={photoUrls[member.id]}
                            alt={member.full_name}
                            className="w-10 h-10 rounded-lg object-cover bg-gray-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center text-sm">
                            📷
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 text-sm truncate">{member.full_name}</p>
                          <p className="text-xs text-gray-500">
                            {member.gender ? member.gender.charAt(0).toUpperCase() : '—'} ·{' '}
                            {member.year_of_study}yr · {formatBudget(member.budget_band)}
                          </p>
                          {member.plus_one && (
                            <p className="text-xs font-medium text-gray-700">
                              +1 · {member.plus_one_name}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCancelMember(group.id, member)}
                          disabled={cancellingId === member.booking_id}
                          className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50 shrink-0"
                        >
                          {cancellingId === member.booking_id ? 'Cancelling…' : 'Cancel'}
                        </button>
                      </div>
                    ))}
                  </div>

                  {(() => {
                    const slotCandidates = candidates.filter((c) => c.slot_id === group.slot_id);
                    const seats = group.members.reduce((sum, m) => sum + (m.plus_one ? 2 : 1), 0);
                    const isFull = seats >= group.max_group_size;

                    if (isFull) {
                      return <p className="text-xs text-gray-400 mt-4">Group is at max size.</p>;
                    }
                    if (slotCandidates.length === 0) {
                      return <p className="text-xs text-gray-400 mt-4">No one waiting for this slot right now.</p>;
                    }

                    return (
                      <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                        <select
                          value={selectedCandidate[group.id] ?? ''}
                          onChange={(e) =>
                            setSelectedCandidate((prev) => ({ ...prev, [group.id]: e.target.value }))
                          }
                          className="flex-1 border rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="">Add a student to this group…</option>
                          {slotCandidates.map((c) => (
                            <option key={c.booking_id} value={c.booking_id}>
                              {c.full_name}
                              {c.plus_one ? ` (+1: ${c.plus_one_name})` : ''}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleAddMember(group)}
                          disabled={!selectedCandidate[group.id] || addingId === group.id}
                          className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                          {addingId === group.id ? 'Adding…' : 'Add'}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
