'use client';

import { useEffect, useRef, useState } from 'react';
import { exampleChat } from '@/lib/content';
import { loadGsap, useNear } from '@/lib/gsap-lazy';

/**
 * Cleo-style chat: bubbles pop in one by one as the section scrolls past.
 * Server-rendered with every bubble showing; JS takes over only when motion
 * is allowed. The conversation is an illustration, labelled as one on the page.
 */
export default function ChatPhone({ triggerId }: { triggerId: string }) {
  const n: number = exampleChat.length;
  const [shown, setShown] = useState<number>(n);
  const scope = useRef<HTMLDivElement>(null);

  const near = useNear(scope);

  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    let revert = () => {};
    loadGsap().then(({ gsap, ScrollTrigger }) => {
      if (cancelled) return;
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        setShown(0);
        const st = ScrollTrigger.create({
          trigger: document.getElementById(triggerId),
          start: 'top 65%',
          end: 'bottom 75%',
          onUpdate: (self) => setShown(Math.min(n, Math.floor(self.progress * (n + 1.5)))),
        });
        return () => {
          st.kill();
          setShown(n);
        };
      });
      revert = () => mm.revert();
    });
    return () => {
      cancelled = true;
      revert();
    };
  }, [near, n, triggerId]);

  return (
    <div ref={scope} className="phone mx-auto w-full max-w-[20rem] rotate-[-3deg]">
      <div className="phone-screen flex flex-col bg-[#0b0a09]">
        <div className="border-b border-white/10 px-4 pb-3 pt-[16%] text-center">
          <p className="text-[0.95rem] font-semibold text-fg">Box Cricket · Sat 6:00 PM</p>
          <p className="mt-0.5 text-[0.75rem] text-muted">Riya, Arjun, Sana, you and 8 more</p>
        </div>
        <ol className="flex flex-1 flex-col justify-end gap-2.5 px-3 pb-4 pt-3">
          {exampleChat.map((m, i) => {
            const on = i < shown;
            if (m.from === 'zen') {
              return (
                <li key={i} className={`chat-b mx-auto w-[92%] rounded-2xl bg-white/[0.07] px-3 py-2.5 text-center text-[0.8125rem] leading-snug text-fg ${on ? 'is-on' : ''}`}>
                  {m.text}
                  <span className="mt-1.5 block rounded-lg border border-dashed border-white/25 px-2 py-1 text-[0.75rem] text-muted">
                    📍 the venue shows up here
                  </span>
                </li>
              );
            }
            const me = m.from === 'me';
            return (
              <li key={i} className={`chat-b flex items-end gap-2 ${me ? 'flex-row-reverse' : ''} ${on ? 'is-on' : ''}`} style={{ transformOrigin: me ? '100% 100%' : '0 100%' }}>
                {!me ? (
                  <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-paper-2 text-[0.75rem] font-bold text-ink">
                    {m.from}
                  </span>
                ) : null}
                <span className={`max-w-[78%] rounded-[1.1rem] px-3 py-2 text-[0.875rem] leading-snug ${me ? 'rounded-br-md bg-red text-white' : 'rounded-bl-md bg-white/[0.1] text-fg'}`}>
                  {!me && 'name' in m ? <span className="block text-[0.6875rem] font-semibold text-red-text">{m.name}</span> : null}
                  {m.text}
                </span>
              </li>
            );
          })}
        </ol>
        <div className="mx-3 mb-4 flex items-center gap-2 rounded-full border border-white/10 px-4 py-2.5 text-[0.8125rem] text-muted">
          Type a message
        </div>
      </div>
      <span className="phone-island" aria-hidden />
    </div>
  );
}
