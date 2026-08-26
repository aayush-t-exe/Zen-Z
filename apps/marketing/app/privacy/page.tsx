import type { Metadata } from 'next';
import LegalLayout from '../../components/legal-layout';

export const metadata: Metadata = {
  title: 'Privacy Policy — Zen-Z',
  description: 'How Zen-Z collects, uses, stores, and protects your information.',
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="August 26, 2026">
      <p>
        This Privacy Policy explains how Zen-Z, operated by Dhruv Goyal,
        collects, uses, stores, and protects information when you use the
        Zen-Z mobile application.
      </p>

      <div className="legal-section">
        <h2>1. Information we collect</h2>
        <h3>Account and profile information</h3>
        <ul>
          <li>Real/legal name</li>
          <li>Email address</li>
          <li>Phone number</li>
          <li>Date of birth</li>
          <li>Gender</li>
          <li>Profile photo</li>
          <li>Year of study</li>
        </ul>
        <h3>Personality and matching information</h3>
        <p>
          Zen-Z collects your responses to its personality quiz. This
          information is used for compatibility-based matching. Your personality
          results and individual answers are never shown to group members.
        </p>
        <h3>Booking and service information</h3>
        <p>
          We process information about activities, dates/times, bookings,
          groups, venue arrangements, booking status, and relevant
          support/refund records.
        </p>
        <h3>Payment information</h3>
        <p>
          Zen-Z does not store card numbers, CVV, UPI credentials, or
          bank-account credentials in its own database. Zen-Z stores
          transaction information needed to manage bookings, such as Razorpay
          payment/order identifiers, payment status, and related transaction
          references.
        </p>
      </div>

      <div className="legal-section">
        <h2>2. How we use information</h2>
        <ul>
          <li>Create and manage user accounts.</li>
          <li>Verify profiles and account information.</li>
          <li>Determine eligibility based on the 16+ age requirement.</li>
          <li>Match users into compatible activity groups.</li>
          <li>Coordinate venues, tables, tickets, and sports slots.</li>
          <li>Process and reconcile payments and refunds.</li>
          <li>Send booking, payment, group, venue, and chat-related push notifications.</li>
          <li>Provide customer support.</li>
          <li>Investigate reports and enforce community rules.</li>
          <li>Maintain security and prevent misuse.</li>
        </ul>
      </div>

      <div className="legal-section">
        <h2>3. Information visible to other group members</h2>
        <p>
          Once a group is revealed, members can see another member&apos;s name
          and year of study only. Phone number, profile photo, date of birth,
          gender, and personality-quiz responses are never shown to other group
          members, under any circumstance.
        </p>
      </div>

      <div className="legal-section">
        <h2>4. Chat privacy</h2>
        <p>
          Normal group chats are private between group members. Zen-Z does not
          routinely read or monitor them.
        </p>
        <p>
          If a user submits a report, authorized Zen-Z personnel may access the
          specific reported message and relevant report information for
          investigation and enforcement.
        </p>
      </div>

      <div className="legal-section">
        <h2>5. Profile photos</h2>
        <p>
          Profile photos are uploaded through the app and stored using Supabase
          Storage. They are used for profile/identity verification only and are
          never displayed to other group members, under any circumstance.
        </p>
        <p>
          Photos must show the actual user and must not contain
          celebrity/public-figure images, logos, cartoons, memes, unrelated
          images, nudity, sexually explicit material, hateful or violent
          imagery, or impersonating content.
        </p>
      </div>

      <div className="legal-section">
        <h2>6. Service providers</h2>
        <p>Zen-Z uses service providers necessary to operate the application:</p>
        <ul>
          <li><strong>Supabase:</strong> backend services, application data, and profile-photo storage.</li>
          <li><strong>Razorpay:</strong> payment processing and related payment services.</li>
          <li><strong>Brevo:</strong> email OTP verification.</li>
          <li><strong>Expo Notifications:</strong> push notifications.</li>
        </ul>
        <p>
          We do not sell, rent, or commercially share personal information.
          Data may be shared with service providers when reasonably necessary
          to provide and secure the service.
        </p>
      </div>

      <div className="legal-section">
        <h2>7. Website privacy</h2>
        <p>
          The Zen-Z website is informational only. It does not provide user
          login, account creation, booking, or payment functionality — those
          happen in the mobile app. The website does not currently use cookies,
          tracking technologies, or analytics services.
        </p>
      </div>

      <div className="legal-section">
        <h2>8. Data retention</h2>
        <p>
          Zen-Z generally retains information while an account is active.
          When a user deletes their account, personal information and the
          profile photo are removed; previously sent chat messages may remain
          visible to other group members. Information may be retained where
          reasonably necessary for legal, accounting, security,
          fraud-prevention, dispute-resolution, or investigation purposes.
        </p>
      </div>

      <div className="legal-section">
        <h2>9. Security</h2>
        <p>
          Zen-Z takes reasonable measures intended to protect information
          against unauthorized access, misuse, loss, or alteration. No method
          of storage or transmission can be guaranteed to be completely secure.
        </p>
      </div>

      <div className="legal-section">
        <h2>10. Children and age</h2>
        <p>
          Zen-Z is intended for users aged 16 and above. Users provide their
          date of birth for age eligibility and matching purposes.
        </p>
      </div>

      <div className="legal-section">
        <h2>11. Changes to this Privacy Policy</h2>
        <p>
          We may update this Privacy Policy when necessary. The Last Updated
          date will change when revisions are made. Material changes may be
          communicated through the app where appropriate.
        </p>
      </div>

      <div className="legal-section">
        <h2>12. Contact</h2>
        <p>
          Privacy questions or requests can be sent to{' '}
          <a href="mailto:teamzenz003@gmail.com">teamzenz003@gmail.com</a>.
          Support is available 24×7 with a typical response target of within
          24 hours.
        </p>
      </div>
    </LegalLayout>
  );
}
