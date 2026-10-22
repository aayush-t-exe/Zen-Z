import type { Metadata } from 'next';
import LegalPage, { Section, toc } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Delete Your Account',
  description: 'How to delete your Zen-Z account and what happens to your data.',
  alternates: { canonical: '/delete-account' },
};

const S = {
  'in-app': 'Delete from the app',
  request: 'Request deletion without the app',
  deleted: 'What gets deleted',
  contact: 'Contact',
};

export default function DeleteAccountPage() {
  return (
    <LegalPage
      title="Delete Your Account"
      updated="September 6, 2026"
      sections={toc(S)}
      lede={
        <>
          You can delete your Zen-Z account and profile information at any
          time, either from inside the app or by requesting it here if you no
          longer have the app installed.
        </>
      }
    >
      <Section id="in-app" title={S['in-app']}>
        <ol>
          <li>Open the Zen-Z app and sign in.</li>
          <li>Go to the Profile tab.</li>
          <li>Scroll down and tap &ldquo;Delete Account.&rdquo;</li>
          <li>Confirm the deletion.</li>
        </ol>
        <p>
          This permanently removes your profile information and photo and
          can&apos;t be undone. If you have a paid booking that&apos;s still
          pending or matched, resolve or cancel it first &mdash; the app
          will ask you to do this before it can complete the deletion.
        </p>
      </Section>

      <Section id="request" title={S.request}>
        <p>
          If you don&apos;t have the app installed or can&apos;t sign in,
          email{' '}
          <a href="mailto:teamzenz003@gmail.com">teamzenz003@gmail.com</a>{' '}
          from your registered email address with the subject &ldquo;Delete
          my account&rdquo; and your full name. We&apos;ll verify the request
          and delete your account within 7 days.
        </p>
      </Section>

      <Section id="deleted" title={S.deleted}>
        <p>
          Your personal information and profile photo are removed. Messages
          you previously sent in a group chat may remain visible to other
          members of that group, since deleting your account can&apos;t
          retroactively remove them from a conversation others were part of.
          Transaction and referral records tied to your account may be
          retained where reasonably necessary for legal, accounting,
          security, fraud-prevention, or dispute-resolution purposes. See the{' '}
          <a href="/privacy">Privacy Policy</a> for the full data-retention
          details.
        </p>
      </Section>

      <Section id="contact" title={S.contact}>
        <p>
          Questions about account deletion can be sent to{' '}
          <a href="mailto:teamzenz003@gmail.com">teamzenz003@gmail.com</a>.
          Support is available 24&times;7 with a typical response target of
          within 24 hours.
        </p>
      </Section>
    </LegalPage>
  );
}
