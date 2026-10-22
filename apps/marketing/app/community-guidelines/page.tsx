import type { Metadata } from 'next';
import LegalPage, { Section, toc } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Community Guidelines',
  description: 'Conduct expectations for everyone using Zen-Z.',
  alternates: { canonical: '/community-guidelines' },
};

const S = {
  respect: 'Be respectful',
  private: 'Keep personal information private',
  meetups: 'Meetup rules',
  profiles: 'Profile rules',
  reporting: 'Reporting',
  enforcement: 'Possible enforcement',
  safety: 'Safety',
};

export default function CommunityGuidelinesPage() {
  return (
    <LegalPage
      title="Community Guidelines"
      updated="September 1, 2026"
      sections={toc(S)}
      lede={
        <>
          Zen-Z is designed to help people meet new people in a respectful,
          welcoming environment. Every participant is expected to contribute to
          that environment.
        </>
      }
    >
      <Section id="respect" title={S.respect}>
        <ul>
          <li>Treat every participant with respect.</li>
          <li>No harassment, bullying, threats, or violence.</li>
          <li>No sexual harassment or unwanted sexual behavior.</li>
          <li>No hate speech or discrimination.</li>
          <li>Respect personal boundaries and privacy.</li>
        </ul>
      </Section>

      <Section id="private" title={S.private}>
        <ul>
          <li>Do not pressure someone to share their phone number.</li>
          <li>Do not share another person&apos;s private information without consent.</li>
          <li>Do not impersonate another person.</li>
        </ul>
      </Section>

      <Section id="meetups" title={S.meetups}>
        <ul>
          <li>Follow the venue&apos;s rules.</li>
          <li>Do not intentionally damage property.</li>
          <li>No illegal activity.</li>
          <li>No alcohol, smoking, tobacco/nicotine products, or drugs at Zen-Z meetups.</li>
          <li>
            If you bring a &ldquo;+1&rdquo; companion, you&apos;re responsible
            for making sure they follow these guidelines too.
          </li>
        </ul>
      </Section>

      <Section id="profiles" title={S.profiles}>
        <p>
          Use your real/legal name and a genuine photo of yourself. Do not use
          celebrity/public-figure photos, logos, cartoons, memes, unrelated
          images, nudity, sexually explicit material, hateful or violent
          imagery, or misleading/impersonating images.
        </p>
      </Section>

      <Section id="reporting" title={S.reporting}>
        <p>
          You can report another participant from the group chat at any time,
          including after an event. Zen-Z reviews the reported information and
          may take appropriate action.
        </p>
      </Section>

      <Section id="enforcement" title={S.enforcement}>
        <p>
          Depending on the circumstances, Zen-Z may issue a warning, restrict
          bookings, suspend an account, remove a user from a group, or
          permanently ban/delete an account. Intentionally false or malicious
          reports may also result in account action.
        </p>
      </Section>

      <Section id="safety" title={S.safety}>
        <p>
          Zen-Z uses reasonable platform measures but cannot guarantee the
          conduct or safety of another participant at a physical venue. For
          immediate danger, contact local emergency services or police first.
        </p>
      </Section>
    </LegalPage>
  );
}
