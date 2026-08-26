import type { Metadata } from 'next';
import LegalLayout from '../../components/legal-layout';

export const metadata: Metadata = {
  title: 'Community Guidelines — Zen-Z',
  description: 'Conduct expectations for everyone using Zen-Z.',
};

export default function CommunityGuidelinesPage() {
  return (
    <LegalLayout title="Community Guidelines" updated="August 26, 2026">
      <p>
        Zen-Z is designed to help people meet new people in a respectful,
        welcoming environment. Every participant is expected to contribute to
        that environment.
      </p>

      <div className="legal-section">
        <h2>Be respectful</h2>
        <ul>
          <li>Treat every participant with respect.</li>
          <li>No harassment, bullying, threats, or violence.</li>
          <li>No sexual harassment or unwanted sexual behavior.</li>
          <li>No hate speech or discrimination.</li>
          <li>Respect personal boundaries and privacy.</li>
        </ul>
      </div>

      <div className="legal-section">
        <h2>Keep personal information private</h2>
        <ul>
          <li>Do not pressure someone to share their phone number.</li>
          <li>Do not share another person&apos;s private information without consent.</li>
          <li>Do not impersonate another person.</li>
        </ul>
      </div>

      <div className="legal-section">
        <h2>Meetup rules</h2>
        <ul>
          <li>Follow the venue&apos;s rules.</li>
          <li>Do not intentionally damage property.</li>
          <li>No illegal activity.</li>
          <li>No alcohol, smoking, tobacco/nicotine products, or drugs at Zen-Z meetups.</li>
        </ul>
      </div>

      <div className="legal-section">
        <h2>Profile rules</h2>
        <p>
          Use your real/legal name and a genuine photo of yourself. Do not use
          celebrity/public-figure photos, logos, cartoons, memes, unrelated
          images, nudity, sexually explicit material, hateful or violent
          imagery, or misleading/impersonating images.
        </p>
      </div>

      <div className="legal-section">
        <h2>Reporting</h2>
        <p>
          You can report another participant from the group chat at any time,
          including after an event. Zen-Z reviews the reported information and
          may take appropriate action.
        </p>
      </div>

      <div className="legal-section">
        <h2>Possible enforcement</h2>
        <p>
          Depending on the circumstances, Zen-Z may issue a warning, restrict
          bookings, suspend an account, remove a user from a group, or
          permanently ban/delete an account. Intentionally false or malicious
          reports may also result in account action.
        </p>
      </div>

      <div className="legal-section">
        <h2>Safety</h2>
        <p>
          Zen-Z uses reasonable platform measures but cannot guarantee the
          conduct or safety of another participant at a physical venue. For
          immediate danger, contact local emergency services or police first.
        </p>
      </div>
    </LegalLayout>
  );
}
