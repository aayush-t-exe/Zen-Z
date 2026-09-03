import type { Metadata } from 'next';
import LegalLayout from '../../components/legal-layout';

export const metadata: Metadata = {
  title: 'Cancellation & Refund Policy — Zen-Z',
  description: 'Cancellation and refund policy for Zen-Z bookings.',
};

export default function RefundPage() {
  return (
    <LegalLayout title="Cancellation & Refund Policy" updated="September 1, 2026">
      <p>
        This policy explains cancellation and refund rules for Zen-Z bookings
        and should be read together with the{' '}
        <a href="/terms">Terms &amp; Conditions</a>.
      </p>

      <div className="legal-section">
        <h2>1. What a booking payment covers</h2>
        <p>
          When you pay for a Café, Dinner, Movie, or Sports slot, that payment
          reserves your seat in a group our team is hand-matching for that
          slot. It is not a purchase you receive immediately — it holds your
          place while we build your group.
        </p>
      </div>

      <div className="legal-section">
        <h2>2. Booking is confirmed only after successful payment</h2>
        <p>
          A slot is not booked unless payment is successfully completed. A
          failed or pending payment does not reserve the slot.
        </p>
      </div>

      <div className="legal-section">
        <h2>3. Cancelling before your slot is paid</h2>
        <p>
          If you have started a booking but not completed payment, you can
          cancel it for free at any time from the Bookings screen. Nothing is
          charged, so there is nothing to refund. If a referral credit was
          already applied as a discount toward this unpaid booking, cancelling
          restores that credit to your account (see Section 14).
        </p>
      </div>

      <div className="legal-section">
        <h2>4. Booking cutoff</h2>
        <p>
          Bookings for a slot close at midnight IST, two days before the slot
          date. Group formation happens around this cutoff.
        </p>
      </div>

      <div className="legal-section">
        <h2>5. Cancelling a paid booking</h2>
        <p>
          Cancelling a paid booking is not currently self-serve in the app. To
          cancel, email{' '}
          <a href="mailto:teamzenz003@gmail.com">teamzenz003@gmail.com</a>{' '}
          before the booking cutoff with your full name, registered email,
          booking ID, activity, scheduled date, and reason for cancellation.
        </p>
        <p>
          If you cancel before the cutoff, you receive a full refund of the
          amount paid, since group matching for that slot has not been
          finalized yet.
        </p>
        <p>
          If you cancel after the cutoff, we are unable to offer a refund. By
          this point our team has started building your group around your
          seat, and other participants are relying on it.
        </p>
      </div>

      <div className="legal-section">
        <h2>6. No-shows and late arrival</h2>
        <p>
          Payment is not refunded if you do not show up to a booked slot,
          regardless of the reason or your no-show strike count. A no-show also
          cannot transfer the booking to another person.
        </p>
        <p>
          A user who arrives late may still join if the meetup is ongoing. If
          the activity or venue booking has already ended, the user is treated
          as a no-show and is not refunded.
        </p>
      </div>

      <div className="legal-section">
        <h2>7. Group not formed</h2>
        <p>
          If Zen-Z cannot form the required group for an activity, the slot is
          cancelled and affected paid users receive an automatic full refund —
          you don&apos;t need to request it.
        </p>
      </div>

      <div className="legal-section">
        <h2>8. Zen-Z cancellation</h2>
        <p>
          If Zen-Z cancels a slot for any reason on our end — including venue
          unavailability or operational issues — you receive a full, automatic
          refund of the amount paid.
        </p>
        <p>Cancelled bookings are not rescheduled.</p>
      </div>

      <div className="legal-section">
        <h2>9. Venue cancellation or unavailability</h2>
        <p>
          If a venue cancels or becomes unavailable at the last moment, Zen-Z
          will try to arrange a suitable alternative venue for the same
          activity. If no suitable alternative can be arranged, the event is
          cancelled and you receive a full refund.
        </p>
      </div>

      <div className="legal-section">
        <h2>10. Venue changes and price changes</h2>
        <p>
          Zen-Z may change the venue to a suitable alternative more than 24
          hours before the event; the booking remains valid and no refund
          applies solely because of that change. If a venue increases its price
          after you have already paid, Zen-Z absorbs the increase — we do not
          charge you extra.
        </p>
      </div>

      <div className="legal-section">
        <h2>11. Payment failure, duplicate payments, and booking failure</h2>
        <p>
          If payment succeeds but a technical issue prevents your booking from
          being created, or if you are charged twice for the same booking, we
          manually review the transaction and process the appropriate refund.
        </p>
      </div>

      <div className="legal-section">
        <h2>12. &ldquo;Bring a +1&rdquo; bookings</h2>
        <p>
          A +1 companion is part of a single booking, not a separate one. The
          booking — including the +1&apos;s seat — follows all the
          cancellation and refund rules in this policy as one unit, at the
          combined price paid. A +1 cannot be added, removed, or refunded
          separately from the rest of the booking after payment.
        </p>
      </div>

      <div className="legal-section">
        <h2>13. How refunds are paid back</h2>
        <p>
          Approved refunds are issued to your original payment method through
          PayU. Users cannot request a refund be sent to a different UPI ID,
          bank account, wallet, or another person&apos;s account. Once a
          refund is initiated, it typically reflects in your account within
          5–21 business days, depending on your bank or payment method — net
          banking refunds through certain banks may take longer.
        </p>
      </div>

      <div className="legal-section">
        <h2>14. Bookings paid with a referral credit</h2>
        <p>
          If your booking was fully or partially paid using a referral credit
          and it&apos;s cancelled under an eligible reason in this policy
          (Sections 3, 5, 7, 8, or 9), the referral credit itself is restored
          to your account for use on a future booking. If any part of that
          booking was paid in real money through PayU, that portion is
          refunded through PayU as described in Section 13. Since a referral
          credit has no cash value, it is never paid out as cash.
        </p>
      </div>

      <div className="legal-section">
        <h2>15. Customer misconduct</h2>
        <p>
          If a booking is cancelled because of user misconduct or a policy
          violation, refund treatment is decided case by case based on the
          circumstances.
        </p>
      </div>

      <div className="legal-section">
        <h2>16. Dissatisfaction with a match</h2>
        <p>
          Dissatisfaction with your matched group, without another qualifying
          cancellation reason, is not a basis for a refund. Zen-Z does not
          guarantee friendship, chemistry, or a particular social experience.
        </p>
      </div>

      <div className="legal-section">
        <h2>17. Chargebacks and payment disputes</h2>
        <p>
          Contact Zen-Z support first so payment issues can be investigated and
          resolved directly. If a formal chargeback or payment dispute is
          opened, Zen-Z will cooperate with the relevant payment provider.
        </p>
      </div>

      <div className="legal-section">
        <h2>18. Contact for refunds</h2>
        <p>
          For any cancellation or refund request, or a question about a charge,
          reach us at{' '}
          <a href="mailto:teamzenz003@gmail.com">teamzenz003@gmail.com</a>.
          Support is available 24×7 with a typical response target of within 24
          hours.
        </p>
      </div>
    </LegalLayout>
  );
}
