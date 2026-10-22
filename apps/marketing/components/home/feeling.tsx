import Image from 'next/image';
import starSide from '@/assets/art/star-side.webp';
import WordReveal from './word-reveal';

// The constitution's "what Zenz stands for", said plainly. No promise of
// finding your people: a table where the odds are good.
const text =
  'You can be surrounded by people and still not have found your people. At JNU, nothing much happens, so nobody gets the chance to. We can’t fix that for everyone. We can put you at a table where the odds are good.';

export default function Feeling() {
  return (
    <section aria-label="Why Zen-Z exists" className="on-ink curve-top relative z-10 bg-ink py-24 text-fg sm:py-32 lg:py-40">
      <div className="cv shell relative">
        <p className="hand text-[1.6rem] text-red-text sm:text-[1.9rem]">honestly,</p>
        <WordReveal
          text={text}
          accent={['your', 'odds', 'good']}
          className="mt-3 max-w-[22ch] text-[clamp(1.9rem,6.6vw,4.4rem)] font-bold leading-[1.08] tracking-[-0.025em] [font-family:var(--font-archivo)] [font-stretch:104%]"
        />
        <p className="mt-10 max-w-md text-[1.0625rem] leading-relaxed text-muted sm:mt-14">
          One evening. Four or five students you haven’t met. Picked by a person who read your answers.
        </p>
        <Image
          src={starSide}
          alt=""
          sizes="120px"
          className="absolute right-[6%] top-[-1rem] hidden w-24 rotate-12 invert sm:block lg:w-32"
        />
      </div>
    </section>
  );
}
