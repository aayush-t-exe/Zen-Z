import { supabase } from '@/lib/supabase';

export interface MyBooking {
  id: string;
  status: string;
  payment_status: string;
  slot_id: string;
  slot_datetime: string;
  activity_name: string;
  activity_emoji: string;
}

export interface MyGroupDetails {
  booking_id: string;
  group_id: string;
  slot_datetime: string;
  reveal_venue_at: string;
  is_revealed: boolean;
  activity_name: string;
  activity_emoji: string;
  venue_name: string | null;
  venue_address: string | null;
  venue_maps_url: string | null;
}

export interface GroupMember {
  id: string;
  first_name: string;
  year_of_study: number;
}

// A booking/group screen needs to tell "the fetch failed" apart from "this
// genuinely doesn't exist" — collapsing both into an empty array (the old
// behavior) made an already-paid, already-matched booking look identical to
// one that was never made, on a transient network error. error is a
// user-safe message (or null on success); callers decide whether that's
// worth a dedicated retry UI or just a console.error-and-degrade.
export interface FetchResult<T> {
  data: T;
  error: string | null;
}

export async function fetchMyBookings(userId: string): Promise<FetchResult<MyBooking[]>> {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      `id, status, payment_status, slot_id,
       slots:slot_id ( slot_datetime, activity_types:activity_type_id ( name, emoji ) )`
    )
    .eq('user_id', userId)
    .neq('status', 'cancelled');

  if (error || !data) {
    console.error('Failed to fetch bookings:', error);
    return { data: [], error: error?.message ?? 'Failed to fetch bookings' };
  }

  const sorted = (data as any[])
    .map((b) => ({
      id: b.id,
      status: b.status,
      payment_status: b.payment_status,
      slot_id: b.slot_id,
      slot_datetime: b.slots?.slot_datetime,
      activity_name: b.slots?.activity_types?.name ?? 'Activity',
      activity_emoji: b.slots?.activity_types?.emoji ?? '',
    }))
    .sort((a, b) => new Date(a.slot_datetime).getTime() - new Date(b.slot_datetime).getTime());

  return { data: sorted, error: null };
}

// my_group_details is self-scoped by RLS (auth.uid()) — no user id needed.
// Venue fields are already null server-side until reveal_venue_at, so
// this never even receives a venue for a group that isn't revealed yet.
export async function fetchMyGroups(): Promise<FetchResult<MyGroupDetails[]>> {
  const { data, error } = await supabase.from('my_group_details').select('*');

  if (error || !data) {
    console.error('Failed to fetch groups:', error);
    return { data: [], error: error?.message ?? 'Failed to fetch groups' };
  }

  return { data: data as MyGroupDetails[], error: null };
}

// Queries group_member_public (never profiles directly) — the same
// privacy-safe view the rest of the app uses for groupmate info, so
// there's no code path here that can pull in photo_url.
//
// Member ids come from group_member_ids(), not a group_members ->
// bookings embedded join — that join used to resolve to null for every
// groupmate (bookings' RLS only allows reading your own row), silently
// dropping everyone but yourself. group_member_ids() (0065) does the same
// join server-side under SECURITY DEFINER, the same pattern already used
// for groupmate_user_ids()/group_member_public itself.
export async function fetchGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data: memberIds, error: idsError } = await supabase.rpc('group_member_ids', {
    p_group_id: groupId,
  });

  if (idsError || !memberIds) {
    console.error('Failed to fetch group member ids:', idsError);
    return [];
  }
  if (memberIds.length === 0) return [];

  const { data: members, error: profileError } = await supabase
    .from('group_member_public')
    .select('id, first_name, year_of_study')
    .in('id', memberIds);

  if (profileError || !members) {
    console.error('Failed to fetch member profiles:', profileError);
    return [];
  }

  return members as GroupMember[];
}

// Total unread chat messages across every group the caller is in — powers
// the Chats tab's nav-bar badge. security-invoker (0066): relies on the
// caller's own RLS on messages/bookings to naturally scope this correctly
// (an unrevealed group's messages aren't readable yet, so they can't
// count as unread; bookings' "own bookings only" policy scopes the join
// to the caller's own group_members row per group).
export async function fetchUnreadMessageCount(): Promise<number> {
  const { data, error } = await supabase.rpc('my_unread_message_count');

  if (error) {
    console.error('Failed to fetch unread message count:', error);
    return 0;
  }

  return typeof data === 'number' ? data : 0;
}

// Bumps the caller's own last_read_at for this group to now — a dedicated
// RPC rather than a direct update() because group_members' own "leave"
// trigger (0048, fixed for this in 0068) needs to tell this apart from an
// actual leave attempt.
export async function markGroupRead(groupId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_group_read', { p_group_id: groupId });
  if (error) {
    console.error('Failed to mark group read:', error);
  }
}
