import type { Metadata } from 'next';
import LegalLayout from '../../components/legal-layout';

export const metadata: Metadata = {
  title: 'About — Zen-Z',
  description: 'What Zen-Z is, how it works, and who runs it.',
};

export default function AboutPage() {
  return (
    <LegalLayout title="About Zen-Z" updated="September 1, 2026">
      <p>
        Zen-Z is a campus-first social app. You take a quiz, pick a slot, and our
        team hand-matches you into a small group of strangers for a Café,
        Dinner, Movie, or Sports session. No swiping, no browsing, no choosing
        who to meet.
      </p>

      <div className="legal-section">
        <h2>How it works</h2>
        <ol>
          <li>Create your Zen-Z profile and complete the personality quiz.</li>
          <li>Choose an activity and slot, and pay the listed per-person amount to reserve your place.</li>
          <li>Our team uses your quiz answers to build a compatible group for that slot.</li>
          <li>Your group is revealed once matching is finalized for that slot.</li>
          <li>The exact venue and the group chat unlock 48 hours before the meetup.</li>
          <li>Use the in-app group chat to coordinate with your group before meeting up.</li>
        </ol>
      </div>

      <div className="legal-section">
        <h2>Activities</h2>
        <p>
          Zen-Z currently runs Café, Dinner, Movie, Box Cricket, Football,
          8-Ball Pool, and Pickleball sessions. Café, Dinner, and Movie are
          always available — none of these are ever gated or hidden, even
          though only one may be our operational focus at a given time.
        </p>
      </div>

      <div className="legal-section">
        <h2>Matching</h2>
        <p>
          Groups are built by a person on our team, using your personality-quiz
          responses together with relevant account information such as age and
          gender. Matching is a best effort at compatibility — it does not
          guarantee friendship or chemistry.
        </p>
      </div>

      <div className="legal-section">
        <h2>What Zen-Z is responsible for</h2>
        <p>
          Zen-Z coordinates compatible groups and arranges the relevant venue,
          table, ticket, or sports slot. We are a coordination platform — we do
          not own or operate the cafés, restaurants, cinemas, or sports
          facilities used for meetups.
        </p>
      </div>

      <div className="legal-section">
        <h2>What you pay at the venue</h2>
        <p>
          Each participant covers their own personal expenses at the venue —
          food, drinks, and other extras. The Zen-Z booking price covers what is
          described on the <a href="/pricing">Pricing</a> page.
        </p>
      </div>

      <div className="legal-section">
        <h2>Privacy by design</h2>
        <p>
          Group members see each other&apos;s name and year of study only.
          Phone numbers, profile photos, date of birth, gender, and personality
          results are never shown to other members, under any circumstance.
        </p>
      </div>

      <div className="legal-section">
        <h2>Bringing a friend, and inviting more</h2>
        <p>
          Don&apos;t have the app yet but want to come along? A student can
          add you as a &ldquo;+1&rdquo; on their own booking instead. And
          every student can invite friends with their own referral code —
          when an invited friend&apos;s first booking is paid, the inviter
          earns a ₹21 credit toward their next one.
        </p>
      </div>

      <div className="legal-section">
        <h2>Who runs Zen-Z</h2>
        <p>
          Zen-Z is operated by Dhruv Goyal, currently as an individual /
          unregistered project based in Jaipur, India.
        </p>
      </div>
    </LegalLayout>
  );
}
