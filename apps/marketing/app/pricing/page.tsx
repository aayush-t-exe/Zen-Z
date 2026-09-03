import type { Metadata } from 'next';
import LegalLayout from '../../components/legal-layout';

export const metadata: Metadata = {
  title: 'Pricing — Zen-Z',
  description: 'Per-person pricing for Zen-Z Café, Dinner, Movie, and Sports slots.',
};

const rows: [string, string, string][] = [
  ['Café', '₹21', '4–5'],
  ['Dinner', '₹21', '4–5'],
  ['Movie', '₹126', '4–5'],
  ['Box Cricket', '₹221', '10–14'],
  ['Football', '₹221', '8–14'],
  ['8-Ball Pool', '₹70', '4'],
  ['Pickleball', '₹129', '4'],
];

export default function PricingPage() {
  return (
    <LegalLayout title="Pricing" updated="September 1, 2026">
      <p>
        Zen-Z charges one flat per-person amount for each activity. The price
        shown in the app at checkout is the final amount you pay — Zen-Z
        absorbs its own payment-processing fees rather than adding them on top.
      </p>

      <div className="legal-section">
        <h2>Activity pricing</h2>
        <table>
          <thead>
            <tr><th>Activity</th><th>Price per person</th><th>Group size</th></tr>
          </thead>
          <tbody>
            {rows.map(([activity, price, size]) => (
              <tr key={activity}>
                <td>{activity}</td>
                <td>{price}</td>
                <td>{size}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-violet-100/50">
          Prices are per person and cover the components described below. They
          may be adjusted from time to time; the amount shown to you at
          checkout is always the price that applies to your booking.
        </p>
      </div>

      <div className="legal-section">
        <h2>What the price covers</h2>
        <p>
          For Café and Dinner, the listed price is Zen-Z&apos;s coordination fee
          for building your group and arranging the table — it does not include
          food or drinks.
        </p>
        <p>
          For Movie and Sports, the listed price covers Zen-Z&apos;s coordination
          fee together with the cost of arranging the movie ticket, or the
          sports venue/court booking, on your behalf.
        </p>
      </div>

      <div className="legal-section">
        <h2>Venue expenses</h2>
        <p>
          Café and Dinner food and drinks are paid separately by each
          participant at the venue. Sports-related extras such as food, drinks,
          or other personal expenses are also paid individually. For Movies,
          Zen-Z arranges the ticket; any additional personal expenses are the
          participant&apos;s responsibility.
        </p>
      </div>

      <div className="legal-section">
        <h2>Payment</h2>
        <p>
          Each booking requires a separate successful payment. A failed or
          pending payment does not reserve the slot.
        </p>
        <p>
          Payments are processed through PayU. Zen-Z does not store card
          numbers, CVV, UPI credentials, or bank-account credentials in its own
          database.
        </p>
      </div>

      <div className="legal-section">
        <h2>Bringing a +1</h2>
        <p>
          Adding a &ldquo;+1&rdquo; companion to a booking automatically
          doubles the price shown above for that activity, charged as a single
          payment. See the <a href="/terms">Terms &amp; Conditions</a> for
          what bringing a +1 involves.
        </p>
      </div>

      <div className="legal-section">
        <h2>Referral credits</h2>
        <p>
          Inviting a friend who completes their first paid booking earns you a
          ₹21 credit, automatically applied to your next booking. See the{' '}
          <a href="/terms">Terms &amp; Conditions</a> for the full referral
          program rules.
        </p>
      </div>

      <div className="legal-section">
        <h2>Refunds</h2>
        <p>
          See the <a href="/refund">Cancellation &amp; Refund Policy</a> for
          when a paid booking is eligible for a refund.
        </p>
      </div>
    </LegalLayout>
  );
}
