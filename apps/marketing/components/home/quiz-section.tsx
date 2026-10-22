import QuizTeaser from './quiz-teaser';

export default function QuizSection() {
  return (
    <section aria-labelledby="quiz-title" className="cv relative bg-paper py-24 sm:py-32">
      <div className="shell">
        <div className="max-w-2xl">
          <p className="hand text-[1.6rem] text-red-deep sm:text-[1.9rem]">try one</p>
          <h2 id="quiz-title" className="display mt-2 text-[clamp(2.6rem,8vw,5.2rem)]">
            You answer a few questions. <span className="warm text-red-deep">We actually read them.</span>
          </h2>
          <p className="mt-5 max-w-lg text-[1.0625rem] leading-relaxed text-ink/80">
            The quiz is about taste and opinions, not your looks or your marks. It’s how we put people at the same table who’ll have something to talk about.
          </p>
        </div>
        <div className="mt-12 sm:mt-16">
          <QuizTeaser />
        </div>
      </div>
    </section>
  );
}
