import type { Metadata } from 'next';
import LegalPage, { Section, toc } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description: 'Terms and conditions governing use of the Zen-Z app.',
  alternates: { canonical: '/terms' },
};

const S = {
  about: '1. About Zen-Z',
  eligibility: '2. Eligibility',
  identity: '3. Real identity and verification',
  matching: '4. Personality matching',
  'group-sizes': '5. Group sizes',
  booking: '6. Booking',
  'plus-one': '7. Bring a +1',
  reveal: '8. Group and venue reveal',
  chat: '9. Group chat',
  venues: '10. Venue responsibilities',
  expenses: '11. Personal expenses at the venue',
  conduct: '12. User conduct',
  reports: '13. Reports and enforcement',
  accounts: '14. Account restrictions and deletion',
  refunds: '15. Booking and refund rules',
  referrals: '16. Referral program',
  safety: '17. Safety and emergencies',
  ip: '18. Intellectual property',
  content: '19. User content',
  'third-parties': '20. Third-party services',
  changes: '21. Changes to these Terms',
  law: '22. Governing law',
  contact: '23. Contact',
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      updated="October 22, 2026"
      sections={toc(S)}
      lede={
        <>
          These Terms &amp; Conditions govern your use of the Zen-Z mobile
          application and related services. Zen-Z is operated by Dhruv Goyal,
          currently as an individual / unregistered project.
        </>
      }
    >
      <Section id="about" title={S.about}>
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
      </Section>

      <Section id="eligibility" title={S.eligibility}>
        <p>
          You must be at least 18 years old to use Zen-Z. Zen-Z does not have
          any parental/guardian consent flow and does not knowingly allow
          anyone under 18 to hold an account. You must provide truthful and
          accurate information.
        </p>
      </Section>

      <Section id="identity" title={S.identity}>
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
      </Section>

      <Section id="matching" title={S.matching}>
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
      </Section>

      <Section id="group-sizes" title={S['group-sizes']}>
        <ul>
          <li>Café, Dinner, and Movie: 4&ndash;5 people.</li>
          <li>Box Cricket: 10&ndash;14 people.</li>
          <li>Football: 8&ndash;14 people.</li>
          <li>8-Ball Pool and Pickleball: exactly 4 people.</li>
        </ul>
        <p>
          A &ldquo;Bring a +1&rdquo; companion (Section 7) counts as one
          additional seat toward these limits &mdash; for example, a Café
          booking with a +1 fills 2 of the 4&ndash;5 seats.
        </p>
        <p>
          When a group reaches its activity-specific maximum, Zen-Z may form a
          separate group for the same activity/date/time.
        </p>
        <p>
          If the required minimum group cannot be formed, Zen-Z cancels the
          slot and automatically refunds affected paid users in full.
        </p>
      </Section>

      <Section id="booking" title={S.booking}>
        <p>
          Café and Dinner bookings are currently free: they are confirmed as
          soon as you book, without any payment. For paid activities (currently
          Movie and Sports), a slot is not booked unless payment is
          successfully completed. A failed or pending payment does not reserve
          the slot. Each paid booking requires a separate successful payment,
          and users may make multiple bookings, including for the same
          activity/date/time.
        </p>
        <p>
          Paid bookings are personal and cannot be transferred to another
          person. After payment, you cannot change the activity, date, or time
          of a booking, or add or remove a +1; a new booking must be made for a
          different slot.
        </p>
        <p>
          A free booking can be cancelled by you from within the app while it
          has not yet been matched into a group.
        </p>
        <p>
          Bookings for a slot close at midnight IST, two days before the slot
          date. Group formation happens around this cutoff, after which Zen-Z
          confirms the relevant venue, table, ticket, court, or other
          arrangement.
        </p>
      </Section>

      <Section id="plus-one" title={S['plus-one']}>
        <p>
          For some activities, you may add one companion (&ldquo;+1&rdquo;) to
          your own booking instead of them booking a separate slot. A +1 does
          not create a Zen-Z account, does not take the personality quiz, and
          does not provide a photo, gender, date of birth, or any other
          information to Zen-Z &mdash; they are not independently verified in
          any way.
        </p>
        <p>By adding a +1, you confirm that:</p>
        <ul>
          <li>
            you have their permission to book on their behalf and to share
            their first name with Zen-Z and the rest of the group for
            coordination purposes;
          </li>
          <li>they are at least 18 years old; and</li>
          <li>
            you take responsibility for their conduct at the meetup, including
            compliance with Section 11 (User conduct) and venue rules.
          </li>
        </ul>
        <p>
          The price for a booking with a +1 is automatically double the listed
          per-person price for that activity, charged as a single payment.
        </p>
        <p>
          Because a +1&apos;s gender is not collected, Zen-Z cannot verify that
          a +1 matches a women-only or men-only group preference; placement in
          that case is a manual judgment call by our team based on the
          information you provide.
        </p>
        <p>
          Zen-Z may refuse, restrict, or remove a +1 booking under the same
          enforcement standards as Sections 12 and 13.
        </p>
      </Section>

      <Section id="reveal" title={S.reveal}>
        <p>
          Your group is revealed once matching is finalized for your slot,
          which can happen well before the event. The exact venue name,
          address, map location, and the group chat unlock separately, 48 hours
          before the scheduled meetup.
        </p>
        <p>
          Group members can see each other&apos;s first name and year of study.
          Phone number, profile photo, date of birth, gender, and
          personality-quiz results are not shown to other group members, under
          any circumstance.
        </p>
      </Section>

      <Section id="chat" title={S.chat}>
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
      </Section>

      <Section id="venues" title={S.venues}>
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
      </Section>

      <Section id="expenses" title={S.expenses}>
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
      </Section>

      <Section id="conduct" title={S.conduct}>
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
          at Zen-Z meetups. If you bring a +1 (Section 7), this conduct
          standard applies to them as well, and you are responsible for it.
        </p>
      </Section>

      <Section id="reports" title={S.reports}>
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
      </Section>

      <Section id="accounts" title={S.accounts}>
        <p>
          Zen-Z may reject profile information, restrict bookings, suspend an
          account, remove a user from a group, or permanently ban/delete an
          account when appropriate, including for false information or serious
          or repeated policy violations.
        </p>
        <p>
          Users may delete their account, from within the app, after all
          active/upcoming bookings have been completed or cancelled. Account
          deletion removes personal information and the profile photo;
          previously sent messages may remain visible to other group members.
          Deleting your account forfeits any unused referral credits and your
          referral code (Section 16).
        </p>
      </Section>

      <Section id="refunds" title={S.refunds}>
        <p>
          Cancellation and refund terms are set out in the{' '}
          <a href="/refund">Cancellation &amp; Refund Policy</a> and form part
          of these Terms. Dissatisfaction with a matched group is not, by
          itself, a basis for a refund.
        </p>
      </Section>

      <Section id="referrals" title={S.referrals}>
        <p>
          Every user can generate one permanent referral code from the Invite
          screen and share it with any number of friends.
        </p>
        <p>
          When someone enters your code and their first paid Zen-Z booking
          (currently a Movie or Sports booking) is successfully paid, you earn
          one referral credit worth ₹21. Free bookings (currently Café and
          Dinner) do not earn a referral credit, and a credit is never applied
          to a free booking. A credit is automatically applied to your next
          unpaid booking that requires payment (currently a Movie or Sports
          booking) as a ₹21 discount, with any remaining balance paid by you
          through PayU as normal. Only one credit is applied per booking.
        </p>
        <p>
          Referral credits have no cash value, cannot be exchanged for money,
          and cannot be transferred to another person or account. You cannot
          use your own referral code, and Zen-Z may withhold or reverse
          credits obtained through fake accounts, self-referral, or other
          fraudulent activity.
        </p>
        <p>
          If a booking that used a referral credit is later cancelled under
          the <a href="/refund">Cancellation &amp; Refund Policy</a>, the
          credit is restored to your account for a future booking rather than
          being lost. If a friend you referred later cancels or is refunded
          for the booking that earned you a credit, a credit you have already
          received and not yet spent is not taken back.
        </p>
      </Section>

      <Section id="safety" title={S.safety}>
        <p>
          Zen-Z cannot supervise users&apos; physical behavior at a venue and
          cannot guarantee the conduct, identity, intentions, or safety of
          another participant. If you face an immediate emergency or danger,
          contact local emergency services or police first, then contact Zen-Z
          for platform-related support or reporting.
        </p>
      </Section>

      <Section id="ip" title={S.ip}>
        <p>
          The Zen-Z name, branding, logo, app and website design, software,
          original text, graphics, and other original materials are owned by
          or used by Zen-Z / Dhruv Goyal as applicable. You may not copy,
          reproduce, modify, sell, distribute, or commercially exploit these
          materials without permission.
        </p>
      </Section>

      <Section id="content" title={S.content}>
        <p>
          Zen-Z may store and process user-submitted information and content to
          operate the service, match users, communicate with you, moderate
          content, maintain safety, provide support, and related platform
          functions. Zen-Z does not sell users&apos; content or use it for
          advertising.
        </p>
      </Section>

      <Section id="third-parties" title={S['third-parties']}>
        <p>
          Zen-Z uses third-party service providers necessary to operate the
          platform, including Supabase for backend/data storage, Brevo for
          email OTP verification, Expo Notifications for push notifications,
          and PayU for payment processing. Their services are governed by
          their own terms and privacy policies.
        </p>
      </Section>

      <Section id="changes" title={S.changes}>
        <p>
          Zen-Z may update these Terms when necessary. The &ldquo;Last
          Updated&rdquo; date will change when the Terms are revised. Material
          changes may be communicated through the app.
        </p>
      </Section>

      <Section id="law" title={S.law}>
        <p>
          These Terms are governed by the laws of India. Subject to applicable
          law, courts in Jaipur, Rajasthan have jurisdiction over disputes.
        </p>
      </Section>

      <Section id="contact" title={S.contact}>
        <p>
          For questions about these Terms, contact{' '}
          <a href="mailto:teamzenz003@gmail.com">teamzenz003@gmail.com</a>.
          Support is available 24×7 with a typical response target of within
          24 hours.
        </p>
      </Section>
    </LegalPage>
  );
}
