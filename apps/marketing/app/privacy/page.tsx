import type { Metadata } from 'next';
import LegalLayout from '../../components/legal-layout';

export const metadata: Metadata = {
  title: 'Privacy Policy — Zen-Z',
  description: 'How Zen-Z collects, uses, stores, and protects your information.',
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="September 1, 2026">
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
          <li>
            WhatsApp number &mdash; used only for event-day coordination such
            as venue changes and reminders; it is never used to sign in and is
            not shown to other group members
          </li>
          <li>Date of birth</li>
          <li>Gender</li>
          <li>Profile photo</li>
          <li>Year of study</li>
          <li>
            Push notification token &mdash; used only to deliver booking,
            group, venue, and chat-related notifications to your device
          </li>
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
          groups, venue arrangements, booking status, the group/budget
          preferences you select when booking, and relevant support/refund
          records.
        </p>
        <p>
          If you add a &ldquo;+1&rdquo; companion to a booking, we store that
          person&apos;s first name, as provided by you, tied to your booking.
          The companion does not create a Zen-Z account and we do not collect
          any other information about them.
        </p>
        <h3>Referral information</h3>
        <p>
          If you use Zen-Z&apos;s referral program, we store your referral
          code, whether you were referred by someone else&apos;s code, a
          record when a friend you invite completes their first paid booking,
          and your referral credit balance.
        </p>
        <h3>Payment information</h3>
        <p>
          Zen-Z does not store card numbers, CVV, UPI credentials, or
          bank-account credentials in its own database. Zen-Z stores
          transaction information needed to manage bookings, such as PayU
          payment/order identifiers, payment status, and related transaction
          references.
        </p>
      </div>

      <div className="legal-section">
        <h2>2. How we use information</h2>
        <ul>
          <li>Create and manage user accounts.</li>
          <li>Verify profiles and account information.</li>
          <li>Determine eligibility based on the 18+ age requirement.</li>
          <li>Match users into compatible activity groups.</li>
          <li>Coordinate venues, tables, tickets, and sports slots.</li>
          <li>Process and reconcile payments and refunds.</li>
          <li>Apply and manage referral credits, and process &ldquo;Bring a +1&rdquo; companion bookings.</li>
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
          members, under any circumstance. If a group member brings a +1, the
          companion&apos;s first name is visible to the rest of the group, the
          same as any other member&apos;s name.
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
          <li><strong>PayU Payments Private Limited:</strong> payment processing and related payment services.</li>
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
          fraud-prevention, dispute-resolution, or investigation purposes,
          including transaction and referral records associated with a
          deleted account.
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
          Zen-Z is intended for users aged 18 and above only. It is not
          directed at children, and we do not knowingly allow anyone under 18
          to create or hold an account. Users provide their date of birth,
          which is checked against this 18+ requirement before an account can
          be created. If you add a &ldquo;+1&rdquo; companion to a booking,
          you are responsible for confirming they also meet this age
          requirement, since Zen-Z has no independent way to verify a
          companion&apos;s age.
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
