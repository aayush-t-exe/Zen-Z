import type { Metadata } from 'next';
import LegalLayout from '../../components/legal-layout';

export const metadata: Metadata = {
  title: 'Terms & Conditions — Zen-Z',
  description: 'Terms and conditions governing use of the Zen-Z app.',
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms & Conditions" updated="August 26, 2026">
      <p>
        These Terms &amp; Conditions govern your use of the Zen-Z mobile
        application and related services. Zen-Z is operated by Dhruv Goyal,
        currently as an individual / unregistered project.
      </p>

      <div className="legal-section">
        <h2>1. About Zen-Z</h2>
        <p>
          Zen-Z is a social activity booking and coordination platform. It
          helps users meet new people by matching participants using
          compatibility information and coordinating activities such as Café,
          Dinner, Movie, Box Cricket, Football, 8-Ball Pool, and Pickleball.
        </p>
        <p>
          Zen-Z is a booking and coordination platform only. It does not own or
          operate the cafés, restaurants, cinemas, or sports facilities used
          for meetups.
        </p>
      </div>

      <div className="legal-section">
        <h2>2. Eligibility</h2>
        <p>
          You must be at least 16 years old to use Zen-Z. Zen-Z does not
          currently have a parental or guardian consent flow for users aged
          16&ndash;17. You must provide truthful and accurate information.
        </p>
      </div>

      <div className="legal-section">
        <h2>3. Real identity and verification</h2>
        <p>
          Users must provide their real/legal name and a genuine profile photo.
          Zen-Z may manually review profile photos to help confirm account
          authenticity; this does not guarantee a user&apos;s identity,
          background, intentions, character, or safety.
        </p>
        <p>
          Zen-Z does not currently conduct criminal-record, police, employment,
          education, or other background checks.
        </p>
      </div>

      <div className="legal-section">
        <h2>4. Personality matching</h2>
        <p>
          Zen-Z uses information from its personality quiz, together with
          relevant account information such as age and gender, to form
          compatibility-based groups.
        </p>
        <p>
          Matching is not a guarantee of friendship, chemistry, compatibility,
          safety, or a particular social experience. Zen-Z makes reasonable
          efforts to form groups it considers compatible based on the
          information available to it.
        </p>
      </div>

      <div className="legal-section">
        <h2>5. Group sizes</h2>
        <ul>
          <li>Café, Dinner, and Movie: 4&ndash;5 people.</li>
          <li>Box Cricket: 10&ndash;14 people.</li>
          <li>Football: 8&ndash;14 people.</li>
          <li>8-Ball Pool and Pickleball: exactly 4 people.</li>
        </ul>
        <p>
          When a group reaches its activity-specific maximum, Zen-Z may form a
          separate group for the same activity/date/time.
        </p>
        <p>
          If the required minimum group cannot be formed, Zen-Z cancels the
          slot and automatically refunds affected paid users in full.
        </p>
      </div>

      <div className="legal-section">
        <h2>6. Booking</h2>
        <p>
          A slot is not booked unless payment is successfully completed. A
          failed or pending payment does not reserve the slot. Each booking
          requires a separate successful payment, and users may make multiple
          bookings, including for the same activity/date/time.
        </p>
        <p>
          Paid bookings are personal and cannot be transferred to another
          person. After payment, you cannot change the activity, date, or time
          of a booking; a new booking must be made for a different slot.
        </p>
        <p>
          Bookings for a slot close at midnight IST, two days before the slot
          date. Group formation happens around this cutoff, after which Zen-Z
          confirms the relevant venue, table, ticket, court, or other
          arrangement.
        </p>
      </div>

      <div className="legal-section">
        <h2>7. Group and venue reveal</h2>
        <p>
          Your group is revealed once matching is finalized for your slot,
          which can happen well before the event. The exact venue name,
          address, map location, and the group chat unlock separately, 48 hours
          before the scheduled meetup.
        </p>
        <p>
          Group members can see each other&apos;s name and year of study. Phone
          number, profile photo, date of birth, gender, and personality-quiz
          results are not shown to other group members, under any circumstance.
        </p>
      </div>

      <div className="legal-section">
        <h2>8. Group chat</h2>
        <p>
          Group chat is text-only. Zen-Z does not routinely read or monitor
          normal private group-chat messages. Users can report another
          participant from the chat. Where a report is submitted, the specific
          reported message may be accessed by authorized Zen-Z personnel,
          solely for investigation and enforcement.
        </p>
        <p>
          Users may delete their own messages; deleted message content is
          permanently removed and other group members see a &ldquo;Message
          deleted&rdquo; placeholder. Users cannot leave a group before or
          during the event; leaving becomes available after the event. An
          administrator may delete a group, in which case its chat messages are
          permanently deleted.
        </p>
      </div>

      <div className="legal-section">
        <h2>9. Venue responsibilities</h2>
        <p>
          Zen-Z coordinates bookings but does not operate the venue. Users are
          responsible for complying with venue rules and for their own conduct
          at the venue.
        </p>
        <p>
          For venue-specific problems involving food, service, staff,
          facilities, entry, or similar matters, contact the venue directly.
          You may also contact Zen-Z for coordination or platform support.
        </p>
      </div>

      <div className="legal-section">
        <h2>10. Personal expenses at the venue</h2>
        <p>
          For Café and Dinner, each participant is individually responsible for
          their food, drinks, and other expenses at the venue.
        </p>
        <p>
          For Sports, Zen-Z confirms the relevant venue/slot; additional
          personal expenses such as food or drinks are paid individually by
          each participant.
        </p>
        <p>
          For Movies, Zen-Z arranges the ticket; additional personal expenses
          remain the participant&apos;s responsibility.
        </p>
      </div>

      <div className="legal-section">
        <h2>11. User conduct</h2>
        <p>
          Users must respect other participants and venues. Prohibited conduct
          includes harassment, bullying, threats, violence, sexual harassment
          or unwanted sexual behavior, hate speech or discrimination, illegal
          activity, intentional property damage, misuse of the chat, attempts
          to obtain or share another person&apos;s private information without
          consent, spam, advertising, fake accounts, false information, and
          other behavior that creates an unsafe or abusive environment.
        </p>
        <p>
          Alcohol, smoking, tobacco/nicotine products, and drugs are prohibited
          at Zen-Z meetups.
        </p>
      </div>

      <div className="legal-section">
        <h2>12. Reports and enforcement</h2>
        <p>
          Users may report another participant at any time, including after an
          event. Zen-Z investigates reports and may warn, restrict, suspend,
          remove a user from a group, restrict bookings, or permanently
          ban/delete an account.
        </p>
        <p>
          A reporter&apos;s identity is kept confidential from the reported
          user except where disclosure is legally required or necessary to
          handle the matter. Intentionally false or malicious reports may
          themselves result in account action.
        </p>
      </div>

      <div className="legal-section">
        <h2>13. Account restrictions and deletion</h2>
        <p>
          Zen-Z may reject profile information, restrict bookings, suspend an
          account, remove a user from a group, or permanently ban/delete an
          account when appropriate, including for false information or serious
          or repeated policy violations.
        </p>
        <p>
          Users may delete their account after all active/upcoming bookings
          have been completed or cancelled. Account deletion removes personal
          information and the profile photo; previously sent messages may
          remain visible to other group members.
        </p>
      </div>

      <div className="legal-section">
        <h2>14. Booking and refund rules</h2>
        <p>
          Cancellation and refund terms are set out in the{' '}
          <a href="/refund">Cancellation &amp; Refund Policy</a> and form part
          of these Terms. Dissatisfaction with a matched group is not, by
          itself, a basis for a refund.
        </p>
      </div>

      <div className="legal-section">
        <h2>15. Safety and emergencies</h2>
        <p>
          Zen-Z cannot supervise users&apos; physical behavior at a venue and
          cannot guarantee the conduct, identity, intentions, or safety of
          another participant. If you face an immediate emergency or danger,
          contact local emergency services or police first, then contact Zen-Z
          for platform-related support or reporting.
        </p>
      </div>

      <div className="legal-section">
        <h2>16. Intellectual property</h2>
        <p>
          The Zen-Z name, branding, logo, app and website design, software,
          original text, graphics, and other original materials are owned by
          or used by Zen-Z / Dhruv Goyal as applicable. You may not copy,
          reproduce, modify, sell, distribute, or commercially exploit these
          materials without permission.
        </p>
      </div>

      <div className="legal-section">
        <h2>17. User content</h2>
        <p>
          Zen-Z may store and process user-submitted information and content to
          operate the service, match users, communicate with you, moderate
          content, maintain safety, provide support, and related platform
          functions. Zen-Z does not sell users&apos; content or use it for
          advertising.
        </p>
      </div>

      <div className="legal-section">
        <h2>18. Third-party services</h2>
        <p>
          Zen-Z uses third-party service providers necessary to operate the
          platform, including Supabase for backend/data storage, Brevo for
          email OTP verification, Expo Notifications for push notifications,
          and Razorpay for payment processing. Their services are governed by
          their own terms and privacy policies.
        </p>
      </div>

      <div className="legal-section">
        <h2>19. Changes to these Terms</h2>
        <p>
          Zen-Z may update these Terms when necessary. The &ldquo;Last
          Updated&rdquo; date will change when the Terms are revised. Material
          changes may be communicated through the app.
        </p>
      </div>

      <div className="legal-section">
        <h2>20. Governing law</h2>
        <p>
          These Terms are governed by the laws of India. Subject to applicable
          law, courts in Jaipur, Rajasthan have jurisdiction over disputes.
        </p>
      </div>

      <div className="legal-section">
        <h2>21. Contact</h2>
        <p>
          For questions about these Terms, contact{' '}
          <a href="mailto:teamzenz003@gmail.com">teamzenz003@gmail.com</a>.
          Support is available 24×7 with a typical response target of within
          24 hours.
        </p>
      </div>
    </LegalLayout>
  );
}
