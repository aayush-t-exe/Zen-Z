import Hero from '@/components/home/hero';
import Feeling from '@/components/home/feeling';
import HowItWorks from '@/components/home/how-it-works';
import Plans from '@/components/home/plans';
import QuizSection from '@/components/home/quiz-section';
import Founder from '@/components/home/founder';
import Safety from '@/components/home/safety';
import Campus from '@/components/home/campus';
import Chat from '@/components/home/chat';
import Faq from '@/components/home/faq';
import Closing from '@/components/home/closing';
import StickyGet from '@/components/home/sticky-get';
import Qr from '@/components/ui/qr';

export default function Home() {
  return (
    <main>
      <Hero />
      <Feeling />
      <HowItWorks />
      <Plans />
      <QuizSection />
      <Founder />
      <Safety />
      <Campus />
      <Chat />
      <Faq />
      <Closing />
      <StickyGet qr={<Qr />} />
    </main>
  );
}
