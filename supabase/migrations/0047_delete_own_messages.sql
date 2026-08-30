-- ============================================
-- 0047_delete_own_messages.sql
--
-- Lets a student delete their own group-chat message. Deletion is a
-- tombstone, not a row removal: `deleted_at` gets set and `content` is
-- wiped, so other members' clients can still render a "Message deleted"
-- placeholder in the right spot in the thread instead of the whole
-- conversation reflowing.
--
-- The only mutation students are allowed to make to an existing message
-- is "delete it" — there's no edit feature. Rather than trust the RLS
-- WITH CHECK clause to police every column on every UPDATE, a trigger
-- pins every other column to its old value and forces deleted_at to
-- now(), so the policy only has to gate *who* can update a row, not
-- *what* the update contains.
-- ============================================

alter table messages add column deleted_at timestamptz;

create or replace function enforce_message_delete_only()
returns trigger
language plpgsql
as $$
begin
  if old.deleted_at is not null then
    raise exception 'message already deleted';
  end if;

  new.group_id := old.group_id;
  new.sender_id := old.sender_id;
  new.is_system := old.is_system;
  new.created_at := old.created_at;
  new.content := null;
  new.deleted_at := now();

  return new;
end;
$$;

create trigger messages_enforce_delete_only
before update on messages
for each row execute function enforce_message_delete_only();

create policy "sender can delete own message" on messages
  for update using (
    auth.uid() = sender_id and is_system = false
  );
