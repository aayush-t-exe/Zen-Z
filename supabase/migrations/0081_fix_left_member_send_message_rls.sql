-- ============================================
-- 0081_fix_left_member_send_message_rls.sql
--
-- 0055_messages_insert_no_system_spoof.sql recreated the "send message"
-- policy to close the is_system spoofing hole, but in doing so dropped
-- the "and gm.left_at is null" clause that was otherwise implicit (no
-- left_at column existed yet at 0055's time — it was added later by
-- 0048... actually 0048 predates 0055 and already added left_at, but
-- 0055 only patched the is_system gap and didn't carry the left_at
-- check forward). Net effect: the READ policy (0048) correctly excludes
-- a member who has left, but the SEND policy never did — a student who
-- left a group (only allowed after the event happens) could still insert
-- messages into it indefinitely, which every remaining member would see,
-- even though the app tells the leaver they've "lost access to the
-- chat." Restoring the same left_at is null check the read policy has.
-- ============================================

drop policy "group members send messages after reveal" on messages;

create policy "group members send messages after reveal" on messages
  for insert with check (
    auth.uid() = sender_id
    and is_system = false
    and exists (
      select 1 from group_members gm join bookings b on b.id = gm.booking_id
      where gm.group_id = messages.group_id and b.user_id = auth.uid() and gm.left_at is null
    )
    and exists (
      select 1 from groups g join slots s on s.id = g.slot_id
      where g.id = messages.group_id and now() >= s.reveal_venue_at
    )
  );
