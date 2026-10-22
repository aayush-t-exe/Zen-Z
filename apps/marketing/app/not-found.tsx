import Image from 'next/image';
import Link from 'next/link';
import tables from '@/assets/art/onboarding-tables.webp';
import starDark from '@/assets/art/star-dark.webp';

export default function NotFound() {
  return (
    <main className="relative overflow-hidden bg-paper pb-24 pt-[calc(var(--header-h)+3rem)] sm:pt-[calc(var(--header-h)+5rem)]">
      <div className="shell grid items-center gap-12 md:grid-cols-[1fr_0.9fr]">
        <div>
          <p className="pill -rotate-2 bg-butter text-[0.8125rem]">404</p>
          <h1 className="display mt-6 text-[3rem] sm:text-[4.5rem]">
            This table <span className="warm text-red">doesn&apos;t exist.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-paper-muted">
            We looked under every one. The page you wanted isn&apos;t here, but there are
            plenty of real tables.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/" className="btn btn-red">
              Take me home
            </Link>
            <Link
              href="/faq"
              className="text-[0.9375rem] font-semibold underline decoration-2 underline-offset-4 hover:text-red-deep"
            >
              Read the FAQ
            </Link>
          </div>
        </div>

        <div className="relative mx-auto w-[min(80vw,380px)]">
          <div className="-rotate-3 rounded-[2rem] border-2 border-ink bg-paper-3 p-4 shadow-[0_6px_0_#0a0908]">
            <Image
              src={tables}
              alt="Illustration of a room full of café tables, every one taken"
              priority
              sizes="(min-width: 768px) 380px, 80vw"
              className="h-auto w-full"
            />
          </div>
          <Image
            src={starDark}
            alt=""
            width={80}
            height={80}
            className="sticker absolute -right-4 -top-6 h-16 w-16 rotate-12 sm:h-20 sm:w-20"
          />
          <p className="hand absolute -bottom-9 right-2 rotate-[-4deg] text-[1.6rem] text-red-deep">
            nope, not this one
          </p>
        </div>
      </div>
    </main>
  );
}
