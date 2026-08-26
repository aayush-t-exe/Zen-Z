import Link from 'next/link';

const steps = [
  {
    title: 'Sign up',
    body: 'Just an email. No student ID, no verification, no waiting on anyone to approve you.',
  },
  {
    title: 'Build your profile',
    body: 'Name, year, a photo. Seen only by our team, building your groups — never by another member.',
  },
  {
    title: 'Take the quiz',
    body: "A handful of questions about how you actually behave socially. It isn't for fun — it feeds every group we build.",
  },
  {
    title: 'Pick a slot',
    body: 'Café, Dinner, or Movie. A day, a time, a budget. Not where, not who — we take it from there.',
  },
  {
    title: 'Wait for your invitation',
    body: "We don't show you a headcount ticking up. Something is being built for you. That's the part worth waiting for.",
  },
  {
    title: 'Meet your group',
    body: 'Four or five strangers, hand-picked, revealed to you first — then, close to the day, so is the place.',
  },
];

const pitches = [
  {
    title: 'Curated, not swiped.',
    body: 'A real person builds every group by hand, using what the quiz actually learned about you — not an algorithm matching you to a stranger\'s dating profile photo.',
  },
  {
    title: 'Your photo stays yours.',
    body: 'No one you\'re matched with ever sees your photo. Not in chat, not at reveal, nowhere. It exists only so our team can build a better group for you.',
  },
  {
    title: 'Café, Dinner, Movie — all live, always.',
    body: 'Nothing here is "coming soon." Every format is open from day one.',
  },
  {
    title: 'The mystery is the point.',
    body: "You won't know exactly who or where until it's close. That's not a limitation — that's the whole idea.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen">
      <section className="mx-auto flex max-w-3xl flex-col items-center px-6 pb-20 pt-28 text-center sm:pt-36">
        <span className="text-sm uppercase tracking-[0.3em] text-violet-300/70">
          A campus, at night, full of strangers
        </span>
        <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Every table has a story
          <br />
          before anyone sits down.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-violet-100/70">
          We craft your group. You just show up. No swiping, no searching —
          just an invitation.
        </p>
        <div className="mt-10 rounded-full border border-violet-300/20 bg-violet-500/10 px-6 py-3 text-sm text-violet-100/80">
          Currently testing on campus — the full invitation opens soon.
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <h2 className="text-center text-sm uppercase tracking-[0.3em] text-violet-300/70">
          How it works
        </h2>
        <ol className="mt-10 grid gap-8 sm:grid-cols-2">
          {steps.map((step, i) => (
            <li key={step.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <span className="text-sm text-violet-300/60">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-2 text-lg font-medium">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-violet-100/60">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <h2 className="text-center text-sm uppercase tracking-[0.3em] text-violet-300/70">
          What makes it different
        </h2>
        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          {pitches.map((pitch) => (
            <div key={pitch.title}>
              <h3 className="text-lg font-medium">{pitch.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-violet-100/60">
                {pitch.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-3xl px-6 py-16 text-center text-sm text-violet-100/40">
        <p>Currently testing on campus. Full launch coming soon.</p>
        <nav className="mt-6 flex flex-wrap justify-center gap-4">
          <Link href="/about" className="hover:text-violet-100/70">About</Link>
          <Link href="/pricing" className="hover:text-violet-100/70">Pricing</Link>
          <Link href="/faq" className="hover:text-violet-100/70">FAQ</Link>
          <Link href="/contact" className="hover:text-violet-100/70">Contact</Link>
          <Link href="/privacy" className="hover:text-violet-100/70">Privacy</Link>
          <Link href="/terms" className="hover:text-violet-100/70">Terms</Link>
          <Link href="/refund" className="hover:text-violet-100/70">Refunds</Link>
          <Link href="/community-guidelines" className="hover:text-violet-100/70">Community Guidelines</Link>
        </nav>
      </footer>
    </main>
  );
}
