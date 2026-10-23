import ChatPhone from './chat-phone';

const points = [
  { t: '48 hours before', b: 'The venue and your group chat unlock together. Say hi, sort out who’s running late.' },
  { t: 'First names and years', b: 'That’s what everyone sees about each other. No photos, no numbers, no profiles to scroll.' },
  { t: '2 hours before', b: 'A reminder, in case your week got busy.' },
];

export default function Chat() {
  return (
    <section id="chat" aria-labelledby="chat-title" className="on-ink curve-top relative z-10 bg-ink py-24 text-fg sm:py-32 lg:min-h-[150vh]">
      {/* The shell is sticky on desktop, so content-visibility goes on its two
          halves instead of a wrapper (and the section keeps its curved top). */}
      <div className="shell grid gap-14 lg:sticky lg:top-24 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:gap-20">
        <div className="cv ![contain-intrinsic-size:auto_640px]">
          <p className="hand text-[1.6rem] text-red-text sm:text-[1.9rem]">before you meet</p>
          <h2 id="chat-title" className="display mt-2 text-[clamp(2.6rem,8vw,5.2rem)]">
            You’ll know who’s <span className="warm text-red-text">bringing the bat.</span>
          </h2>
          <ul className="mt-10 grid max-w-lg gap-6">
            {points.map((p) => (
              <li key={p.t} className="grid grid-cols-[auto_1fr] gap-4">
                <span aria-hidden className="mt-2 h-3 w-3 rounded-full bg-red" />
                <div>
                  <p className="display-tight text-[1.35rem]">{p.t}</p>
                  <p className="mt-1 text-[1rem] leading-relaxed text-muted">{p.b}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <figure className="cv ![contain-intrinsic-size:auto_760px]">
          <ChatPhone triggerId="chat" />
          <figcaption className="hand mx-auto mt-6 max-w-xs text-center text-[1.35rem] leading-tight text-muted">
            an example, not a real chat: roughly what your group chat looks like 48h before
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
