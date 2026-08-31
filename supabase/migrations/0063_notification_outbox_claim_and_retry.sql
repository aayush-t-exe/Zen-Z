-- ============================================
-- 0063_notification_outbox_claim_and_retry.sql
--
-- send-notifications (0019) selected `status = 'pending'` rows, called
-- Expo, then updated status afterward. Two gaps found in a notification
-- reliability audit:
--
-- 1. Duplicate sends: the `notification-cycle` cron (0019) invokes
--    send-notifications every minute via a fire-and-forget net.http_post —
--    it never waits for the previous invocation to finish. If one run
--    takes longer than a minute (slow Expo response, a big batch), the
--    next run's SELECT sees the exact same still-`pending` rows and sends
--    them a second time. Fixed by claiming rows atomically first (SELECT
--    ... FOR UPDATE SKIP LOCKED, flipping them to 'sending' in the same
--    statement) so two overlapping invocations can never claim the same
--    row.
-- 2. No retry path: once a row left 'pending' it never got reprocessed —
--    a transient failure (network blip, Expo 5xx) was as permanent as a
--    real one. `retry_count` + requeuing back to 'pending' (bounded, see
--    logic.ts's MAX_RETRIES) fixes that; a genuinely dead token
--    (DeviceNotRegistered) is instead cleared from profiles.push_token so
--    it stops generating false failures and self-heals on the user's next
--    app launch, which already re-registers a fresh token (_layout.tsx).
--
-- `claimed_at` also guards against the send-notifications invocation
-- itself crashing/timing out mid-batch, which would otherwise strand rows
-- in 'sending' forever (no query ever looks at 'sending' again) — the
-- claim function reclaims any 'sending' row stale for more than 5 minutes,
-- a window generous enough to never collide with a genuinely in-progress
-- run given Expo calls complete in seconds and the cron itself is 1/min.
-- ============================================

alter table notifications_outbox
  drop constraint notifications_outbox_status_check;
alter table notifications_outbox
  add constraint notifications_outbox_status_check
  check (status in ('pending', 'sending', 'sent', 'skipped', 'failed'));

alter table notifications_outbox add column retry_count int not null default 0;
alter table notifications_outbox add column claimed_at timestamptz;

create or replace function claim_pending_notifications(p_limit int)
returns setof notifications_outbox
language sql
as $$
  update notifications_outbox
  set status = 'sending', claimed_at = now()
  where id in (
    select id from notifications_outbox
    where status = 'pending'
       or (status = 'sending' and claimed_at < now() - interval '5 minutes')
    order by created_at
    limit p_limit
    for update skip locked
  )
  returning *;
$$;

grant execute on function claim_pending_notifications(int) to service_role;
