import Image from 'next/image';
import Phone from '@/components/ui/phone';
import Qr from '@/components/ui/qr';
import GetAppCta from '@/components/ui/get-app-cta';
import CircleBadge from '@/components/ui/circle-badge';
import { Sparkle } from '@/components/ui/icons';
import { rollingPeople, rollingPlans, traitPills } from '@/lib/content';
import { proof } from '@/lib/site';
import HangingZ from './hanging-z';
import RollingSentence from './rolling-sentence';
import StickerStage from './sticker-stage';
import zGlossy from '@/assets/brand/z-glossy.webp';
import cafes from '@/assets/icons/cafes.webp';
import movies from '@/assets/icons/movies.webp';
import cricket from '@/assets/icons/cricket.webp';
import pool from '@/assets/icons/pool.webp';
import matchBanner from '@/assets/art/home-match-banner.webp';
import starSide from '@/assets/art/star-side.webp';
import starDark from '@/assets/art/star-dark.webp';
import sHome from '@/assets/screens/01-home.webp';
import sSports from '@/assets/screens/02-sports.webp';
import sSlot from '@/assets/screens/03-time-slot.webp';
import sGroup from '@/assets/screens/05-group-type.webp';
import sPlan from '@/assets/screens/06-plan.webp';

const shots = [
  { src: sHome, alt: 'The Zen-Z app home screen: Cafés and Dinners marked free, Movies from ₹126, and Sports.' },
  { src: sSports, alt: '' },
  { src: sSlot, alt: '' },
  { src: sGroup, alt: '' },
  { src: sPlan, alt: '' },
];


export default function Hero() {
  return (
    <section id="top" className="relative overflow-x-clip bg-paper pb-16 pt-[calc(var(--header-h)+2.25rem)] sm:pb-24 lg:pt-[calc(var(--header-h)+3rem)]">
      {/* The Z hangs from just under the nav bar: beside "Spend" on phones, top right on desktop. */}
      <HangingZ className="left-[80%] [--len:104px] [--zw:80px] [--note-x:calc(var(--zw)*-1.42)] [--note-y:calc(var(--len)+var(--zw)*0.28)] sm:left-[72%] lg:left-[84%] lg:[--len:200px] lg:[--zw:150px] lg:[--note-x:calc(var(--zw)*-1.15)] lg:[--note-y:calc(var(--len)+var(--zw)*0.15)]" />

      <div className="shell relative grid gap-y-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:gap-x-8 lg:gap-y-0">
        <div className="relative z-10 lg:col-span-2">
          <p className="eyebrow rounded-full border-2 border-ink bg-paper-3 py-1.5 pl-2.5 pr-3.5 shadow-[0_3px_0_#0A0908]">
            <span className="pulse relative inline-block h-2.5 w-2.5 rounded-full bg-red" aria-hidden />
            Live at JNU Jaipur
          </p>

          <RollingSentence plans={rollingPlans} people={rollingPeople} className="mt-9 lg:mt-7" />
        </div>

        <div className="relative z-10 lg:pt-10">
          <p className="max-w-[30rem] text-[1.125rem] leading-relaxed text-ink/80 sm:text-[1.25rem]">
            Pick a plan. Answer a few questions. A person on our team builds the table by hand.{' '}
            <span className="warm text-red-deep">You just show up.</span>
          </p>

          <GetAppCta className="mt-8" />

          <p className="mt-8 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[0.9375rem] text-paper-muted">
            <span>
              <strong className="display-tight text-[1.6rem] text-ink">{proof.launchStudents}</strong> students in the first 2 days
            </span>
            <span>
              <strong className="display-tight text-[1.6rem] text-ink">{proof.instagramViews}</strong> views on Instagram
            </span>
          </p>
        </div>

        {/* Phone and the sticker storm (Locket). Stickers drift and can be dragged. */}
        <StickerStage className="relative mx-auto mt-4 aspect-[1/1.08] w-full max-w-[34rem] lg:-mt-10 lg:max-w-[34rem]">
          <div className="absolute left-1/2 top-1/2 w-[48%] -translate-x-1/2 lg:w-[45%] -translate-y-1/2 rotate-[5deg]">
            <Phone shots={shots} sizes="(min-width: 1024px) 260px, 48vw" cycle video>
              {/* QR stuck onto the phone like a sticker: desktop only. */}
              <div className="absolute -right-[46%] bottom-[3%] hidden w-[66%] rotate-[4deg] rounded-[1.4rem] border-2 border-ink bg-white p-3 pb-2 shadow-[0_6px_0_#0A0908] lg:block">
                <Qr className="aspect-square w-full" />
                <p className="hand mt-1 text-center text-[1.35rem] leading-none text-ink">scan with your phone</p>
              </div>
            </Phone>
          </div>

          <div data-depth="0.6" data-rot="-10" className="sticker absolute left-[1%] top-[56%] w-[46%] lg:left-[-12%] lg:top-[60%] lg:w-[44%]" style={{ transform: 'rotate(-10deg)' }}>
            <Image src={matchBanner} alt="" sizes="(min-width: 1024px) 260px, 46vw" className="h-auto w-full" />
          </div>
          <div data-depth="0.9" data-rot="-12" className="sticker absolute left-[8%] top-[4%] w-[21%] lg:left-[2%] lg:top-[38%] lg:w-[19%]" style={{ transform: 'rotate(-12deg)' }}>
            <Image src={cafes} alt="" sizes="120px" className="h-auto w-full" />
          </div>
          <div data-depth="0.5" data-rot="10" className="sticker absolute right-[4%] top-[2%] w-[22%]" style={{ transform: 'rotate(10deg)' }}>
            <Image src={movies} alt="" sizes="130px" className="h-auto w-full" />
          </div>
          <div data-depth="0.8" data-rot="18" className="sticker absolute right-[1%] top-[44%] w-[22%] lg:right-[-12%] lg:top-[40%] lg:w-[20%]" style={{ transform: 'rotate(18deg)' }}>
            <Image src={cricket} alt="" sizes="130px" className="h-auto w-full" />
          </div>
          <div data-depth="1" data-rot="-6" className="sticker absolute bottom-[3%] right-[18%] w-[15%] lg:bottom-[-2%] lg:left-[16%] lg:right-auto lg:w-[13%]" style={{ transform: 'rotate(-6deg)' }}>
            <Image src={pool} alt="" sizes="90px" className="h-auto w-full" />
          </div>
          <div data-depth="0.3" data-rot="12" className="absolute right-[24%] top-[-3%] w-[9%]" style={{ transform: 'rotate(12deg)' }}>
            <Image src={starSide} alt="" sizes="60px" className="h-auto w-full" />
          </div>
          <div data-depth="0.7" data-rot="-14" className="absolute bottom-[10%] left-[3%] w-[8%] lg:left-[-9%]" style={{ transform: 'rotate(-14deg)' }}>
            <Image src={starDark} alt="" sizes="50px" className="h-auto w-full" />
          </div>
          <Sparkle className="absolute left-[30%] top-[10%] w-[4%] text-red" />
          <Sparkle className="absolute bottom-[22%] right-[6%] w-[3%] text-ink" />

          {/* Trait pills: the kind of thing the quiz picks up. */}
          <span data-depth="0.45" data-rot="-5" className="pill absolute left-[-1%] top-[30%] bg-butter text-[0.8125rem] sm:text-[0.9375rem] lg:left-[-14%] lg:top-[26%]" style={{ transform: 'rotate(-5deg)' }}>
            {traitPills[0]}
          </span>
          <span data-depth="0.65" data-rot="6" className="pill absolute right-[-1%] top-[30%] lg:right-[-8%] lg:top-[26%] bg-paper-3 text-[0.8125rem] sm:text-[0.9375rem]" style={{ transform: 'rotate(6deg)' }}>
            {traitPills[1]}
          </span>
          <span data-depth="0.55" data-rot="-3" className="pill absolute bottom-[-2%] right-[30%] lg:bottom-[-4%] lg:right-[34%] bg-red text-[0.8125rem] text-white sm:text-[0.9375rem]" style={{ transform: 'rotate(-3deg)' }}>
            {traitPills[2]}
          </span>

          <div data-depth="0.25" data-drag="off" className="absolute right-[-3%] top-[66%] hidden w-[22%] sm:block lg:left-[-38%] lg:right-auto lg:top-[72%] lg:w-[19%]">
            <CircleBadge text="BUILT BY HAND · ONE TABLE AT A TIME · " label="Built by hand, one table at a time">
              <Image src={zGlossy} alt="" sizes="60px" className="h-auto w-full" />
            </CircleBadge>
          </div>
        </StickerStage>
      </div>
    </section>
  );
}
