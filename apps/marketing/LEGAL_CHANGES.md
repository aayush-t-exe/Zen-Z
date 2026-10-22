# Legal text changes on `marketing-redesign`: for Aayush and Dhruv to approve

The website redesign moved every legal page into a new reading layout. The wording
stayed the same except for the few sentences below, which were out of date after
two product changes:

- **Cafés and Dinners became free on 28 Sep 2026** (migration `0101_free_cafe_dinner.sql`).
  A free booking is confirmed without payment, can be cancelled by the student while
  it is unmatched, never earns a referral credit and never uses one.
- **Groupmates see first name only, not full name** (migration
  `0057_group_member_public_first_name_only.sql`), plus year of study.

Nothing else in Terms, Privacy or Refunds was reworded. Community Guidelines and
Delete Account have no text changes (their "Last updated" dates are unchanged).
Please approve, edit or reject each change before the branch is merged.

---

## Terms & Conditions (`/terms`)

"Last updated" changes from September 1, 2026 to **October 22, 2026**.

### 1. Section 6, Booking: first paragraph

**Before**
> A slot is not booked unless payment is successfully completed. A failed or pending
> payment does not reserve the slot. Each booking requires a separate successful
> payment, and users may make multiple bookings, including for the same
> activity/date/time.

**After**
> Café and Dinner bookings are currently free: they are confirmed as soon as you book,
> without any payment. For paid activities (currently Movie and Sports), a slot is not
> booked unless payment is successfully completed. A failed or pending payment does
> not reserve the slot. Each paid booking requires a separate successful payment, and
> users may make multiple bookings, including for the same activity/date/time.

**Why:** the old text said every booking needs a payment, which stopped being true
when Cafés and Dinners went free.

### 2. Section 6, Booking: new paragraph (added after the "Paid bookings are personal…" paragraph)

**Before:** *(nothing)*

**After**
> A free booking can be cancelled by you from within the app while it has not yet been
> matched into a group.

**Why:** the app now lets students give up a free seat themselves from Your Events
("Can't make it? Give up your seat") while the booking is unmatched (PRODUCT_SPEC §1.6).

### 3. Section 8, Group and venue reveal: second paragraph

**Before**
> Group members can see each other's name and year of study.

**After**
> Group members can see each other's **first** name and year of study.

**Why:** since migration 0057 the app only shows groupmates a first name.

### 4. Section 16, Referral program: second paragraph

**Before**
> When someone enters your code and their first Zen-Z booking is successfully paid, you
> earn one referral credit worth ₹21. A credit is automatically applied to your next
> unpaid booking: it fully covers Café, Dinner, Box Cricket, or Football (₹21 fee), and
> gives a ₹21 discount on pricier activities (Movie, 8-Ball Pool, Pickleball), with any
> remaining balance paid by you through PayU as normal. Only one credit is applied per
> booking.

**After**
> When someone enters your code and their first paid Zen-Z booking (currently a Movie
> or Sports booking) is successfully paid, you earn one referral credit worth ₹21. Free
> bookings (currently Café and Dinner) do not earn a referral credit, and a credit is
> never applied to a free booking. A credit is automatically applied to your next
> unpaid booking that requires payment (currently a Movie or Sports booking) as a ₹21
> discount, with any remaining balance paid by you through PayU as normal. Only one
> credit is applied per booking.

**Why:** the old text was wrong twice over. Cafés and Dinners are free (no fee to
cover), and Box Cricket and Football cost ₹221, not ₹21. Since 0101, only a friend's
first *paid* booking earns a credit, and a credit only comes off a paid booking.

---

## Privacy Policy (`/privacy`)

"Last updated" changes from September 1, 2026 to **October 22, 2026**.

### 5. Section 3, Information visible to other group members

**Before**
> Once a group is revealed, members can see another member's name and year of study
> only.

**After**
> Once a group is revealed, members can see another member's **first** name and year of
> study only.

**Why:** same as change 3 (migration 0057).

---

## Cancellation & Refund Policy (`/refund`)

"Last updated" changes from September 1, 2026 to **October 22, 2026**.

### 6. Section 1, What a booking payment covers

**Before**
> When you pay for a Café, Dinner, Movie, or Sports slot, that payment reserves your
> seat in a group our team is hand-matching for that slot. It is not a purchase you
> receive immediately — it holds your place while we build your group.

**After**
> Café and Dinner bookings are currently free, so there is nothing to refund on them. A
> free booking can be cancelled from the app while it has not yet been matched into a
> group.
>
> When you pay for a paid slot (currently Movie or Sports), that payment reserves your
> seat in a group our team is hand-matching for that slot. It is not a purchase you
> receive immediately — it holds your place while we build your group. The rest of this
> policy applies to paid bookings.

**Why:** you can't pay for a Café or Dinner any more, and the self-serve cancel for
free bookings should be stated where people look for cancellation rules.

### 7. Section 2, Booking is confirmed only after successful payment

**Before**
> A slot is not booked unless payment is successfully completed.

**After**
> A **paid** slot is not booked unless payment is successfully completed.

**Why:** free slots are confirmed without payment.

The no-show rule (Section 6: no refund on a no-show) is unchanged. Note that the
Content Constitution still says "no-show: full refund + next booking free"; the site
follows this Refund Policy and PRODUCT_SPEC, so the constitution line is the stale one.

---

## Not changed, but worth a look (optional)

1. **Em dashes in legal text.** The site's voice rule bans em dashes, but legal pages
   were left as they are to avoid rewording approved text. They appear in: Terms §5,
   §7; Privacy §1 (two list items), §7; Refunds §1, §7, §8 (two), §10, §12 (two), §13;
   Delete Account "Delete from the app". Want them replaced with commas/full stops in a
   follow-up? (No change in meaning either way.)
2. **Wrong cross-reference in Terms §7.** It says "compliance with Section 11 (User
   conduct)", but User conduct is Section 12 (Section 11 is Personal expenses). Fix to
   "Section 12"?
3. **Terms §9 and Privacy §4 vs. the homepage.** The legal text says authorised staff
   *may* access a specific reported message. The homepage says "We don't read your
   chats" and "There's no screen on our side that shows the messages", which matches
   CLAUDE.md (no admin UI shows chat content; the Reports queue shows who, which group
   and the reason). Both are true today, but please confirm you're happy with both
   statements standing side by side.
4. **Email provider.** Terms §20 and Privacy §6 name Brevo for OTP email. That's still
   correct (docs/DEPLOYMENT.md §4a: ZeptoMail is a standby only). If you ever switch to
   ZeptoMail, both pages need updating.
5. **Terms §3 says users give "a genuine profile photo" which Zen-Z "may manually
   review … to help confirm account authenticity".** The site never claims ID
   verification, and this clause doesn't either, but flagging it since the brief bans
   any verification claim.
