-- "group members send messages after reveal" (0018_group_reveal_and_chat.sql)
-- checks sender_id/membership/reveal-gate but never constrained is_system —
-- a direct insert could set is_system=true and render as an unattributed
-- centered system line instead of a normal chat bubble from that student.
-- No legitimate code path has ever set is_system=true (only the column
-- default, false, is used today), so this closes pure exploit surface.
drop policy "group members send messages after reveal" on messages;

create policy "group members send messages after reveal" on messages
  for insert with check (
    auth.uid() = sender_id
    and is_system = false
    and exists (
      select 1 from group_members gm join bookings b on b.id = gm.booking_id
      where gm.group_id = messages.group_id and b.user_id = auth.uid()
    )
    and exists (
      select 1 from groups g join slots s on s.id = g.slot_id
      where g.id = messages.group_id and now() >= s.reveal_venue_at
    )
  );
