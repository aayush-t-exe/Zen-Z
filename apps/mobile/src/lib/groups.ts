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
}

export interface GroupMember {
  id: string;
  full_name: string;
  year_of_study: number;
}

export async function fetchMyBookings(userId: string): Promise<MyBooking[]> {
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
    return [];
  }

  return (data as any[])
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
}

// my_group_details is self-scoped by RLS (auth.uid()) — no user id needed.
// Venue fields are already null server-side until reveal_venue_at, so
// this never even receives a venue for a group that isn't revealed yet.
export async function fetchMyGroups(): Promise<MyGroupDetails[]> {
  const { data, error } = await supabase.from('my_group_details').select('*');

  if (error || !data) {
    console.error('Failed to fetch groups:', error);
    return [];
  }

  return data as MyGroupDetails[];
}

// Queries group_member_public (never profiles directly) — the same
// privacy-safe view the rest of the app uses for groupmate info, so
// there's no code path here that can pull in photo_url.
export async function fetchGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data: memberBookings, error: memberError } = await supabase
    .from('group_members')
    .select('bookings:booking_id ( user_id )')
    .eq('group_id', groupId);

  if (memberError || !memberBookings) {
    console.error('Failed to fetch group members:', memberError);
    return [];
  }

  const userIds = (memberBookings as any[]).map((gm) => gm.bookings?.user_id).filter(Boolean);
  if (userIds.length === 0) return [];

  const { data: members, error: profileError } = await supabase
    .from('group_member_public')
    .select('id, full_name, year_of_study')
    .in('id', userIds);

  if (profileError || !members) {
    console.error('Failed to fetch member profiles:', profileError);
    return [];
  }

  return members as GroupMember[];
}
