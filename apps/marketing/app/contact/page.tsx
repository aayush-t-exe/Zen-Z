import type { Metadata } from 'next';
import LegalLayout from '../../components/legal-layout';

export const metadata: Metadata = {
  title: 'Contact — Zen-Z',
  description: 'How to reach Zen-Z support for bookings, payments, refunds, and safety concerns.',
};

export default function ContactPage() {
  return (
    <LegalLayout title="Contact Us" updated="August 26, 2026">
      <p>
        Need help with a booking, payment, refund, account, or safety concern?
        Reach the Zen-Z support team below.
      </p>

      <div className="legal-section">
        <h2>Support</h2>
        <p>
          <strong>Email:</strong>{' '}
          <a href="mailto:teamzenz003@gmail.com">teamzenz003@gmail.com</a>
        </p>
        <p><strong>Phone:</strong> 9460623157</p>
        <p><strong>Phone:</strong> 7069183086</p>
        <p><strong>Availability:</strong> 24×7</p>
        <p><strong>Typical response target:</strong> within 24 hours</p>
      </div>

      <div className="legal-section">
        <h2>Refund requests</h2>
        <p>
          Send paid-booking refund requests to the same support email before
          the applicable cancellation cutoff. Include your full name,
          registered email, booking ID, activity, scheduled date, and reason
          for cancellation. See the <a href="/refund">Cancellation &amp; Refund
          Policy</a> for eligibility.
        </p>
      </div>

      <div className="legal-section">
        <h2>Address</h2>
        <p>
          Zen-Z<br />
          Operated by Dhruv Goyal<br />
          A-21, Anand Vihar, Railway Colony,<br />
          Jagatpura, Jaipur, Rajasthan – 302017,<br />
          India
        </p>
      </div>

      <div className="legal-section">
        <h2>Emergency situations</h2>
        <p>
          If you are in immediate danger, contact local emergency services or
          police first. Contact Zen-Z afterward for platform-related support
          or reporting.
        </p>
      </div>
    </LegalLayout>
  );
}
