-- ============================================
-- 0026_booking_confirmed_on_payment.sql
-- Bug fix: enqueue_booking_confirmed() (0019) fired on `bookings` INSERT,
-- so students got "Your invitation is sealed" the moment they picked a
-- slot — before paying. The copy (and payment.tsx's identical "sealed"
-- screen, shown only once payment_status = 'paid') both mean the booking
-- is actually confirmed, i.e. paid. Move the trigger to fire when
-- razorpay-webhook flips payment_status to 'paid' instead of at booking
-- creation.
-- ============================================

drop trigger if exists on_booking_confirmed on bookings;

create or replace function enqueue_booking_confirmed()
returns trigger
language plpgsql
security definer
as $$
declare
  v_title text;
  v_body text;
begin
  if new.payment_status <> 'paid' or old.payment_status = 'paid' then
    return new;
  end if;

  select 'Your invitation is sealed.',
         a.name || ', ' || to_char(s.slot_datetime at time zone 'Asia/Kolkata', 'Dy HH12:MI AM')
  into v_title, v_body
  from slots s join activity_types a on a.id = s.activity_type_id
  where s.id = new.slot_id;

  insert into notifications_outbox (user_id, type, reference_id, title, body, data)
  values (new.user_id, 'booking_confirmed', new.id, v_title, v_body,
          jsonb_build_object('bookingId', new.id))
  on conflict (type, user_id, reference_id) do nothing;

  return new;
end;
$$;

create trigger on_booking_confirmed
  after update of payment_status on bookings
  for each row execute function enqueue_booking_confirmed();
