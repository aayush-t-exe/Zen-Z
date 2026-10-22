/* eslint-disable @next/next/no-img-element -- ImageResponse (Satori) only renders plain <img>. */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

// The share card: cream paper, the glossy red Z, and the hero's sentence with
// its two pills. Rendered once at build time (Node runtime, fonts read from
// assets/fonts: static instances of Archivo and Fraunces Italic, both OFL).
export const alt =
  'Zen-Z: Spend a café evening with 4 people you haven’t met. Live at JNU Jaipur.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const INK = '#0A0908';
const PAPER = '#E9E3D5';
const PAPER_3 = '#F3EEE3';
const RED = '#E10600';
const RED_DEEP = '#A80400';
const MUTED = '#5C564C';

function Pill({ children, tilt }: { children: string; tilt: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '4px 26px 10px',
        borderRadius: 999,
        border: `5px solid ${INK}`,
        background: PAPER_3,
        boxShadow: `0 7px 0 ${INK}`,
        color: RED_DEEP,
        fontFamily: 'Fraunces',
        fontStyle: 'italic',
        fontSize: 60,
        letterSpacing: -1.5,
        transform: `rotate(${tilt}deg)`,
      }}
    >
      {children}
      <svg width="26" height="18" viewBox="0 0 26 18" style={{ marginTop: 10 }}>
        <path d="M2 2h22L13 16Z" fill={RED} stroke={RED} strokeWidth="3" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export default async function OpengraphImage() {
  const root = process.cwd();
  const [display, semi, fraunces, z] = await Promise.all([
    readFile(join(root, 'assets/fonts/Archivo-Display.ttf')),
    readFile(join(root, 'assets/fonts/Archivo-SemiBold.ttf')),
    readFile(join(root, 'assets/fonts/Fraunces-SemiBoldItalic.ttf')),
    readFile(join(root, 'assets/brand/z-glossy-og.png')),
  ]);
  const zSrc = `data:image/png;base64,${z.toString('base64')}`;

  const word = { fontFamily: 'Archivo', fontSize: 80, letterSpacing: -3, lineHeight: 1 } as const;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: PAPER,
          color: INK,
          padding: '56px 64px',
        }}
      >
        {/* The Z, hanging from a cord off the top edge, tied to its left head. */}
        <div
          style={{
            position: 'absolute',
            right: 70,
            top: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            transform: 'rotate(-6deg)',
            transformOrigin: '62px 0',
          }}
        >
          <div style={{ width: 4, height: 64, background: INK, borderRadius: 4, marginLeft: 60 }} />
          <div style={{ width: 20, height: 20, borderRadius: 999, border: `4px solid ${INK}`, marginLeft: 52, marginTop: -2 }} />
          <img src={zSrc} width={232} height={259} style={{ marginTop: -4 }} alt="" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img src={zSrc} width={40} height={45} alt="" />
            <span style={{ fontFamily: 'Archivo', fontSize: 40, letterSpacing: -1.5 }}>Zen-Z</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 26, marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
              <span style={word}>Spend</span>
              <Pill tilt={-1.5}>a café evening</Pill>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
              <span style={word}>with</span>
              <Pill tilt={1}>4 people you haven’t met</Pill>
              <span style={word}>.</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontFamily: 'ArchivoSemi', fontSize: 28, color: MUTED }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px', borderRadius: 999, background: INK, color: PAPER }}>
              <div style={{ width: 12, height: 12, borderRadius: 999, background: RED }} />
              Live at JNU Jaipur
            </div>
            <span>We build the table by hand. You just show up.</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Archivo', data: display, weight: 800, style: 'normal' },
        { name: 'ArchivoSemi', data: semi, weight: 600, style: 'normal' },
        { name: 'Fraunces', data: fraunces, weight: 600, style: 'italic' },
      ],
    }
  );
}
