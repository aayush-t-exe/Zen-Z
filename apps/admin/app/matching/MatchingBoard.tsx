'use client';

import { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { supabase } from '@/lib/supabase';
import {
  averagePairwiseSimilarity,
  averageSimilarityToGroup,
  type ScoreVector,
} from '@/lib/compatibility';
import { getSignedPhotoUrls } from '@/lib/photos';
import { formatBudget } from '@/lib/format';

export interface Booking {
  id: string;
  user_id: string;
  budget_band: string;
  group_preference: string;
  profile: {
    id: string;
    full_name: string;
    gender: string | null;
    year_of_study: number;
    photo_url: string | null;
  };
}

// A women_only/men_only booking is a hard constraint, not a scoring input —
// per docs/PRODUCT_SPEC.md §3.6: "hard filters (group_preference, existing
// reports/blocklist) are still applied before this score is ever computed."
// Once any member of a group requires a specific gender, that requirement
// applies to every other member regardless of that member's own preference.
export function requiredGenderForGroup(members: Booking[]): 'male' | 'female' | null {
  if (members.some((m) => m.group_preference === 'women_only')) return 'female';
  if (members.some((m) => m.group_preference === 'men_only')) return 'male';
  return null;
}

// A pairwise key for the reporter/reported blocklist — order-independent
// since neither direction should ever be groupable together again.
export function pairKey(userIdA: string, userIdB: string): string {
  return [userIdA, userIdB].sort().join('|');
}

export function placementViolation(
  candidate: Booking,
  members: Booking[],
  blockedPairs: Set<string>
): string | null {
  const candidateGender = candidate.profile.gender;

  if (candidate.group_preference === 'women_only' && members.some((m) => m.profile.gender !== 'female')) {
    return `${candidate.profile.full_name} wants a women-only group.`;
  }
  if (candidate.group_preference === 'men_only' && members.some((m) => m.profile.gender !== 'male')) {
    return `${candidate.profile.full_name} wants a men-only group.`;
  }

  const required = requiredGenderForGroup(members);
  if (required && candidateGender !== required) {
    return `This group is ${required === 'female' ? 'women' : 'men'}-only.`;
  }

  // Mirrors the permanent reporter/reported blocklist hard-gated in
  // confirm_group() (0021_reports_moderation.sql), so a founder sees why
  // a placement is impossible before dragging it in rather than only on
  // a failed "Book Venue" call. An open report on its own is NOT a hard
  // filter — founder decision (2026-08-14): it's surfaced as a warning
  // badge only (see hasOpenReport on StudentCard) so the founder can
  // watch the reported student and act manually, not an automatic pause.
  const blockedWith = members.find((m) => blockedPairs.has(pairKey(candidate.user_id, m.user_id)));
  if (blockedWith) {
    return `${candidate.profile.full_name} can't be placed with ${blockedWith.profile.full_name} — one has reported the other.`;
  }

  return null;
}

interface Venue {
  id: string;
  name: string;
}

interface GroupDraft {
  localId: string;
  venueId: string | null;
}

export default function MatchingBoard({
  slotId,
  activityTypeId,
  minGroupSize,
  maxGroupSize,
}: {
  slotId: string;
  activityTypeId: number;
  minGroupSize: number;
  maxGroupSize: number;
}) {
  const [unmatched, setUnmatched] = useState<Booking[]>([]);
  const [openReportedUserIds, setOpenReportedUserIds] = useState<Set<string>>(new Set());
  const [blockedPairs, setBlockedPairs] = useState<Set<string>>(new Set());
  const [scoresByUser, setScoresByUser] = useState<Record<string, ScoreVector>>({});
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [dimensionIds, setDimensionIds] = useState<number[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [groups, setGroups] = useState<GroupDraft[]>([]);
  const [placements, setPlacements] = useState<Record<string, string | null>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [confirmingGroupId, setConfirmingGroupId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [boardError, setBoardError] = useState('');
  const groupCounter = useRef(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setBoardError('');
      setGroups([]);
      setPlacements({});

      const [{ data: bookings }, { data: dims }, { data: venuesData }, { data: reportsData }] =
        await Promise.all([
          supabase
            .from('bookings')
            .select(
              `id, user_id, budget_band, group_preference,
             profile:user_id ( id, full_name, gender, year_of_study, photo_url )`
            )
            .eq('slot_id', slotId)
            .eq('status', 'pending_match')
            // confirm_group() (0017_require_payment_for_confirm_group.sql)
            // rejects the whole booking unless it's also paid — matching
            // that here means the pool only ever contains groupable
            // bookings, instead of letting a founder drag an unpaid
            // student in only to have the confirm call fail with no
            // warning beforehand.
            .eq('payment_status', 'paid'),
          supabase.from('personality_dimensions').select('id'),
          supabase.from('venues').select('id, name').eq('activity_type_id', activityTypeId),
          // reported_user_id/status feeds the open-report warning badge
          // (informational only — no auto-pause, founder decision
          // 2026-08-14); reporter_id+reported_user_id feeds the
          // permanent blocklist, which IS hard-gated the same way in
          // confirm_group() (0021_reports_moderation.sql).
          supabase.from('reports').select('reporter_id, reported_user_id, status'),
        ]);

      const bookingsList = (bookings as any as Booking[]) ?? [];
      setUnmatched(bookingsList);
      setDimensionIds((dims ?? []).map((d: any) => d.id));
      setVenues(venuesData ?? []);

      setOpenReportedUserIds(
        new Set(
          (reportsData ?? [])
            .filter((r: any) => r.status === 'open')
            .map((r: any) => r.reported_user_id)
        )
      );
      setBlockedPairs(
        new Set((reportsData ?? []).map((r: any) => pairKey(r.reporter_id, r.reported_user_id)))
      );

      getSignedPhotoUrls(
        bookingsList.map((b) => ({ id: b.profile.id, hasPhoto: !!b.profile.photo_url }))
      ).then(setPhotoUrls);

      const userIds = bookingsList.map((b) => b.user_id);
      if (userIds.length > 0) {
        const { data: scores } = await supabase
          .from('personality_scores')
          .select('user_id, dimension_id, score')
          .in('user_id', userIds);

        const map: Record<string, ScoreVector> = {};
        (scores ?? []).forEach((s: any) => {
          if (!map[s.user_id]) map[s.user_id] = {};
          map[s.user_id][s.dimension_id] = s.score;
        });
        setScoresByUser(map);
      } else {
        setScoresByUser({});
      }

      setLoading(false);
    };

    load();
  }, [slotId, activityTypeId]);

  const membersOf = (groupLocalId: string) =>
    unmatched.filter((b) => placements[b.id] === groupLocalId);

  const poolBookings = unmatched.filter((b) => !placements[b.id]);

  const photoFor = (booking: Booking): string | undefined => photoUrls[booking.profile.id];

  const addGroup = () => {
    groupCounter.current += 1;
    setGroups((prev) => [...prev, { localId: `g${groupCounter.current}`, venueId: null }]);
  };

  const removeGroup = (localId: string) => {
    setPlacements((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((bookingId) => {
        if (next[bookingId] === localId) next[bookingId] = null;
      });
      return next;
    });
    setGroups((prev) => prev.filter((g) => g.localId !== localId));
  };

  const setGroupVenue = (localId: string, venueId: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.localId === localId ? { ...g, venueId: venueId || null } : g))
    );
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const bookingId = String(active.id);
    const overId = String(over.id);

    if (overId === 'pool') {
      setBoardError('');
      setPlacements((prev) => ({ ...prev, [bookingId]: null }));
      return;
    }

    if (overId.startsWith('group-')) {
      const groupLocalId = overId.slice('group-'.length);
      const currentMembers = membersOf(groupLocalId).filter((b) => b.id !== bookingId);
      const candidate = unmatched.find((b) => b.id === bookingId);

      if (currentMembers.length >= maxGroupSize) {
        setBoardError(`That group is already at the max size of ${maxGroupSize}.`);
        return;
      }

      const violation = candidate
        ? placementViolation(candidate, currentMembers, blockedPairs)
        : null;
      if (violation) {
        setBoardError(violation);
        return;
      }

      setBoardError('');
      setPlacements((prev) => ({ ...prev, [bookingId]: groupLocalId }));
    }
  };

  const groupScore = (groupLocalId: string): number | null => {
    const vectors = membersOf(groupLocalId).map((m) => scoresByUser[m.user_id] ?? {});
    return averagePairwiseSimilarity(vectors, dimensionIds);
  };

  const bestFitForPoolCard = (booking: Booking): { groupNumber: number; score: number } | null => {
    let best: { groupNumber: number; score: number } | null = null;
    groups.forEach((group, idx) => {
      const members = membersOf(group.localId);
      if (members.length === 0) return;
      if (placementViolation(booking, members, blockedPairs)) return;
      const candidate = scoresByUser[booking.user_id] ?? {};
      const memberVectors = members.map((m) => scoresByUser[m.user_id] ?? {});
      const sim = averageSimilarityToGroup(candidate, memberVectors, dimensionIds);
      if (sim !== null && (!best || sim > best.score)) {
        best = { groupNumber: idx + 1, score: sim };
      }
    });
    return best;
  };

  const handleBookGroup = async (group: GroupDraft) => {
    const members = membersOf(group.localId);
    setConfirmingGroupId(group.localId);
    setBoardError('');

    try {
      const { error } = await supabase.rpc('confirm_group', {
        p_slot_id: slotId,
        p_venue_id: group.venueId,
        p_booking_ids: members.map((m) => m.id),
      });

      if (error) throw error;

      const bookedIds = new Set(members.map((m) => m.id));
      setUnmatched((prev) => prev.filter((b) => !bookedIds.has(b.id)));
      setPlacements((prev) => {
        const next = { ...prev };
        bookedIds.forEach((id) => delete next[id]);
        return next;
      });
      setGroups((prev) => prev.filter((g) => g.localId !== group.localId));
    } catch (err: any) {
      console.error('Error confirming group:', err);
      setBoardError(err?.message || 'Failed to book this group. Please try again.');
    } finally {
      setConfirmingGroupId(null);
    }
  };

  // A booking here is always still pending_match (this board only ever
  // loads that pool) whether it's sitting in the unmatched pool or placed
  // in an in-memory draft group — confirm_group() hasn't run yet, so
  // admin_cancel_booking() (0070) never finds a real group_members row to
  // clean up for anything cancelled from this screen.
  const handleCancelBooking = async (booking: Booking) => {
    if (!window.confirm(`Cancel ${booking.profile.full_name}'s booking? This can't be undone.`)) return;

    setCancellingId(booking.id);
    setBoardError('');
    try {
      const { error } = await supabase.rpc('admin_cancel_booking', { p_booking_id: booking.id });
      if (error) throw error;

      setUnmatched((prev) => prev.filter((b) => b.id !== booking.id));
      setPlacements((prev) => {
        const next = { ...prev };
        delete next[booking.id];
        return next;
      });
    } catch (err: any) {
      console.error('Error cancelling booking:', err);
      setBoardError(err?.message || 'Failed to cancel this booking. Please try again.');
    } finally {
      setCancellingId(null);
    }
  };

  const activeBooking = activeId ? unmatched.find((b) => b.id === activeId) ?? null : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {boardError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {boardError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        <DropZone id="pool" className="bg-white rounded-lg border p-4">
          <h3 className="font-bold mb-1">Unmatched Pool</h3>
          <p className="text-sm text-gray-500 mb-4">{poolBookings.length} waiting</p>
          <div className="space-y-3">
            {poolBookings.length === 0 ? (
              <p className="text-sm text-gray-500">✨ Everyone&apos;s been placed into a group.</p>
            ) : (
              poolBookings.map((booking) => {
                const fit = bestFitForPoolCard(booking);
                return (
                  <DraggableCard key={booking.id} id={booking.id}>
                    <StudentCard
                      booking={booking}
                      photoUrl={photoFor(booking)}
                      compatibilityBadge={fit}
                      hasOpenReport={openReportedUserIds.has(booking.user_id)}
                      onCancel={() => handleCancelBooking(booking)}
                      cancelling={cancellingId === booking.id}
                    />
                  </DraggableCard>
                );
              })
            )}
          </div>
        </DropZone>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">Groups ({minGroupSize}–{maxGroupSize} students)</h3>
            <button
              onClick={addGroup}
              className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm font-medium"
            >
              + New Group
            </button>
          </div>

          {groups.length === 0 ? (
            <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
              Add a group, then drag students in from the unmatched pool.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groups.map((group, idx) => {
                const members = membersOf(group.localId);
                const sizeOk = members.length >= minGroupSize && members.length <= maxGroupSize;
                const canBook = sizeOk && !!group.venueId && confirmingGroupId === null;
                const score = groupScore(group.localId);
                const genderConstraint = requiredGenderForGroup(members);

                return (
                  <DropZone
                    key={group.localId}
                    id={`group-${group.localId}`}
                    className="bg-white rounded-lg border p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold flex items-center gap-2">
                        Group {idx + 1} ({members.length}/{maxGroupSize})
                        {genderConstraint && (
                          <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {genderConstraint === 'female' ? 'Women only' : 'Men only'}
                          </span>
                        )}
                      </h4>
                      <button
                        onClick={() => removeGroup(group.localId)}
                        className="text-xs text-gray-400 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </div>

                    {score !== null && (
                      <p className="text-xs text-gray-500 mb-3">
                        Compatibility: {(score * 100).toFixed(0)}%
                      </p>
                    )}

                    <div className="space-y-2 min-h-[60px] mb-4">
                      {members.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">Drop students here</p>
                      ) : (
                        members.map((booking) => (
                          <DraggableCard key={booking.id} id={booking.id}>
                            <StudentCard
                              booking={booking}
                              photoUrl={photoFor(booking)}
                              compact
                              onCancel={() => handleCancelBooking(booking)}
                              cancelling={cancellingId === booking.id}
                            />
                          </DraggableCard>
                        ))
                      )}
                    </div>

                    <div className="space-y-2">
                      <select
                        value={group.venueId ?? ''}
                        onChange={(e) => setGroupVenue(group.localId, e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">Select venue…</option>
                        {venues.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                      {!sizeOk && members.length > 0 && (
                        <p className="text-xs text-orange-600">
                          Needs {minGroupSize}–{maxGroupSize} students to book.
                        </p>
                      )}
                      <button
                        disabled={!canBook}
                        onClick={() => handleBookGroup(group)}
                        className="w-full py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        {confirmingGroupId === group.localId ? 'Booking…' : 'Book Venue'}
                      </button>
                    </div>
                  </DropZone>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <DragOverlay>
        {activeBooking ? (
          <StudentCard
            booking={activeBooking}
            photoUrl={photoFor(activeBooking)}
            compact
            dragging
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function DropZone({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`${className ?? ''} ${isOver ? 'ring-2 ring-blue-400' : ''}`}>
      {children}
    </div>
  );
}

function DraggableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`touch-none cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-40' : ''}`}
    >
      {children}
    </div>
  );
}

function StudentCard({
  booking,
  photoUrl,
  compact = false,
  dragging = false,
  compatibilityBadge = null,
  hasOpenReport = false,
  onCancel,
  cancelling = false,
}: {
  booking: Booking;
  photoUrl?: string;
  compact?: boolean;
  dragging?: boolean;
  compatibilityBadge?: { groupNumber: number; score: number } | null;
  hasOpenReport?: boolean;
  onCancel?: () => void;
  cancelling?: boolean;
}) {
  const profile = booking.profile;

  return (
    <div
      className={`border rounded-lg bg-white ${compact ? 'p-2' : 'p-3'} ${
        dragging ? 'shadow-lg' : ''
      } ${hasOpenReport ? 'border-red-300 bg-red-50' : ''}`}
    >
      {hasOpenReport && (
        <p className="text-xs font-medium text-red-600 mb-1">⚠️ Open report — review before matching</p>
      )}
      <div className="flex gap-3 items-center">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={profile.full_name}
            className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} rounded-lg object-cover bg-gray-200`}
          />
        ) : (
          <div
            className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} rounded-lg bg-gray-200 flex items-center justify-center text-sm`}
          >
            📷
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 text-sm truncate">{profile.full_name}</p>
          <p className="text-xs text-gray-500">
            {profile.gender ? profile.gender.charAt(0).toUpperCase() : '—'} · {profile.year_of_study}yr ·{' '}
            {formatBudget(booking.budget_band)}
          </p>
          {booking.group_preference !== 'mixed' && (
            <p className="text-xs font-medium text-gray-700 mt-0.5">
              {booking.group_preference === 'women_only' ? 'Women only' : 'Men only'}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <a
            href={`/student/${profile.id}`}
            target="_blank"
            rel="noopener noreferrer"
            onPointerDown={(e) => e.stopPropagation()}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            View
          </a>
          {onCancel && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onCancel}
              disabled={cancelling}
              className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
            >
              {cancelling ? 'Cancelling…' : 'Cancel'}
            </button>
          )}
        </div>
      </div>
      {compatibilityBadge && !compact && (
        <p className="text-xs text-gray-500 mt-2">
          {(compatibilityBadge.score * 100).toFixed(0)}% w/ Group {compatibilityBadge.groupNumber}
        </p>
      )}
    </div>
  );
}

