'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminGuard, AdminAccessDenied, AdminAuthLoading } from '@/lib/adminAuth';
import { getSignedPhotoUrls } from '@/lib/photos';
import { formatBudget, formatSlotDateTime } from '@/lib/format';
import Link from 'next/link';

interface Member {
  id: string;
  full_name: string;
  gender: string | null;
  year_of_study: number;
  photo_url: string | null;
  budget_band: string;
  group_preference: string;
}

interface Group {
  id: string;
  created_at: string;
  slot_datetime: string;
  activity_name: string;
  activity_emoji: string;
  venue_name: string | null;
  reveal_venue_at: string;
  members: Member[];
}

export default function GroupsPage() {
  const { status } = useAdminGuard();
  const [groups, setGroups] = useState<Group[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadGroups = async () => {
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('groups')
      .select(
        `id, created_at,
         slots:slot_id ( slot_datetime, reveal_venue_at, activity_types:activity_type_id ( name, emoji ) ),
         venues:venue_id ( name ),
         group_members (
           bookings:booking_id (
             budget_band, group_preference,
             profile:user_id ( id, full_name, gender, year_of_study, photo_url )
           )
         )`
      )
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error loading groups:', fetchError);
      setError('Failed to load groups');
      setLoading(false);
      return;
    }

    const mapped: Group[] = (data ?? []).map((g: any) => ({
      id: g.id,
      created_at: g.created_at,
      slot_datetime: g.slots?.slot_datetime,
      reveal_venue_at: g.slots?.reveal_venue_at,
      activity_name: g.slots?.activity_types?.name ?? 'Unknown',
      activity_emoji: g.slots?.activity_types?.emoji ?? '',
      venue_name: g.venues?.name ?? null,
      members: (g.group_members ?? [])
        .map((gm: any) => gm.bookings)
        .filter(Boolean)
        .map((b: any) => ({
          id: b.profile.id,
          full_name: b.profile.full_name,
          gender: b.profile.gender,
          year_of_study: b.profile.year_of_study,
          photo_url: b.profile.photo_url,
          budget_band: b.budget_band,
          group_preference: b.group_preference,
        })),
    }));

    setGroups(mapped);

    const allPhotoPaths = mapped.flatMap((g) => g.members.map((m) => m.photo_url));
    getSignedPhotoUrls(allPhotoPaths).then(setPhotoUrls);

    setLoading(false);
  };

  useEffect(() => {
    if (status !== 'authorized') return;
    loadGroups();
  }, [status]);

  const handleDelete = async (group: Group) => {
    if (
      !window.confirm(
        `Delete this ${group.activity_name} group? This permanently removes the group, its chat, and its members' link to it for everyone. This can't be undone.`
      )
    )
      return;

    setDeletingId(group.id);
    setError('');
    try {
      const { error: deleteError } = await supabase.from('groups').delete().eq('id', group.id);
      if (deleteError) throw deleteError;
      await loadGroups();
    } catch (err: any) {
      console.error('Error deleting group:', err);
      setError(
        err?.message?.includes('foreign key')
          ? "Can't delete this group — a report has been filed against it, so its record is kept."
          : err?.message || 'Failed to delete group.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (status === 'checking') {
    return <AdminAuthLoading />;
  }

  if (status === 'denied') {
    return <AdminAccessDenied />;
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-surface border-b border-line sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-ink-muted hover:text-ink">
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-ink">Groups</h1>
          </div>
          <Link href="/matching" className="text-sm text-ink-muted hover:text-ink">
            Go to Matching Queue →
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-danger/10 border border-danger/30 text-danger px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ink"></div>
          </div>
        ) : groups.length === 0 ? (
          <div className="bg-surface rounded-lg border border-line p-8 text-center text-ink-muted">
            No groups confirmed yet — head to the matching queue to form one.
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => {
              const isRevealed = new Date(group.reveal_venue_at) <= new Date();
              const hasMeetHappened = new Date(group.slot_datetime) < new Date();
              return (
                <div key={group.id} className="bg-surface rounded-lg border border-line p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-semibold text-lg text-ink">
                        {group.activity_emoji} {group.activity_name}
                      </p>
                      <p className="text-sm text-ink-muted">
                        {formatSlotDateTime(group.slot_datetime)}
                        {group.venue_name && ` · ${group.venue_name}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          isRevealed ? 'bg-emerald-500/15 text-emerald-400' : 'bg-surface-selected text-ink-muted'
                        }`}
                      >
                        {isRevealed ? 'Venue & chat revealed' : 'Revealed 48h before event'}
                      </span>
                      {hasMeetHappened && (
                        <button
                          onClick={() => handleDelete(group)}
                          disabled={deletingId === group.id}
                          className="text-xs font-medium text-danger hover:text-danger/80 disabled:opacity-50"
                        >
                          {deletingId === group.id ? 'Deleting…' : 'Delete group'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {group.members.map((member) => (
                      <div key={member.id} className="flex items-center gap-3 border border-line rounded-lg p-3">
                        {member.photo_url && photoUrls[member.photo_url] ? (
                          <img
                            src={photoUrls[member.photo_url]}
                            alt={member.full_name}
                            className="w-10 h-10 rounded-lg object-cover bg-surface-selected"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-surface-selected flex items-center justify-center text-sm">
                            📷
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-ink text-sm truncate">{member.full_name}</p>
                          <p className="text-xs text-ink-muted">
                            {member.gender ? member.gender.charAt(0).toUpperCase() : '—'} ·{' '}
                            {member.year_of_study}yr · {formatBudget(member.budget_band)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
