/**
 * The blob cast.
 *
 * No student ever sees another student's photo (see docs/ARCHITECTURE.md
 * "Photo privacy"), which leaves a face-shaped hole in a social app. A
 * blob fills it: a character drawn deterministically from a seed, so the
 * same person is the same character on every screen and every device,
 * with no image, no URL and no storage object involved at any layer.
 *
 * The same shape also carries booking state, which is why `faceless`
 * exists. A sealed booking is a blob with no face yet. The 48h reveal
 * gives it a face and a name. One object does avatar, empty state and
 * progress mechanic.
 *
 * 4 silhouettes x 5 faces x 4 hair marks x 5 colours = 400 combinations,
 * which is more than enough to keep a group of five visually distinct.
 */

import { memo } from 'react';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { Palette } from '@/constants/theme';

const SILHOUETTES = [
  'M50 4C72 4 95 21 94 48 93 75 73 96 49 96 25 96 5 76 6 49 7 22 28 4 50 4Z',
  'M52 5C77 3 93 25 91 51 89 77 71 96 46 94 21 92 7 71 9 45 11 19 27 7 52 5Z',
  'M50 8C79 8 96 27 96 51 96 75 75 92 49 92 23 92 4 73 4 49 4 25 21 8 50 8Z',
  'M48 5C74 3 96 23 95 50 94 77 70 97 46 95 22 93 4 74 5 47 6 20 22 7 48 5Z',
];

const BLOB_COLORS = [
  Palette.marigold,
  Palette.sindoor,
  Palette.cobalt,
  Palette.bubblegum,
  Palette.paan,
];

/** Sclera stays a fixed warm white so the eye reads on every fill colour. */
const SCLERA = '#F8F6EC';

type Ink = { s: string };

function Eye({
  cx,
  cy,
  rx,
  ry,
  px,
  py,
  pr,
  s,
}: Ink & { cx: number; cy: number; rx: number; ry: number; px: number; py: number; pr: number }) {
  return (
    <>
      <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={SCLERA} stroke={s} strokeWidth={2.5} />
      <Circle cx={px} cy={py} r={pr} fill={s} />
    </>
  );
}

function Stroke({ d, s, w = 3.4 }: Ink & { d: string; w?: number }) {
  return <Path d={d} fill="none" stroke={s} strokeWidth={w} strokeLinecap="round" />;
}

const FACES: ((s: string) => React.ReactNode)[] = [
  // Open eyes, wide smile.
  (s) => (
    <>
      <Eye cx={37} cy={45} rx={8.5} ry={10.5} px={38} py={48} pr={4.8} s={s} />
      <Eye cx={64} cy={45} rx={8.5} ry={10.5} px={65} py={48} pr={4.8} s={s} />
      <Stroke d="M38 67 Q50 77 62 67" s={s} />
    </>
  ),
  // Open eyes, small round mouth.
  (s) => (
    <>
      <Eye cx={37} cy={44} rx={8} ry={10} px={37} py={47} pr={4.6} s={s} />
      <Eye cx={64} cy={44} rx={8} ry={10} px={64} py={47} pr={4.6} s={s} />
      <Ellipse cx={50} cy={70} rx={6.5} ry={7.5} fill={s} />
    </>
  ),
  // Wink.
  (s) => (
    <>
      <Stroke d="M29 48 Q37 39 45 48" s={s} />
      <Eye cx={64} cy={45} rx={8.5} ry={10.5} px={65} py={48} pr={4.8} s={s} />
      <Stroke d="M39 68 Q51 77 62 66" s={s} />
    </>
  ),
  // Both eyes creased shut.
  (s) => (
    <>
      <Stroke d="M28 49 Q37 38 46 49" s={s} />
      <Stroke d="M55 49 Q64 38 73 49" s={s} />
      <Stroke d="M42 68 Q50 74 58 68" s={s} />
    </>
  ),
  // Wide eyes, flat mouth.
  (s) => (
    <>
      <Eye cx={36} cy={44} rx={9.5} ry={12} px={36} py={47} pr={4.2} s={s} />
      <Eye cx={65} cy={44} rx={9.5} ry={12} px={65} py={47} pr={4.2} s={s} />
      <Stroke d="M41 70 L60 70" s={s} w={3.2} />
    </>
  ),
];

const HAIRS: (string | null)[] = [
  null,
  'M27 16 Q31 1 43 9',
  'M60 13 C67 0 82 5 77 18',
  'M40 8 Q50 -4 60 8',
];

/** FNV-1a. Stable across platforms and JS engines, which matters because the
 *  same user must get the same blob on their phone and in a groupmate's list. */
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type BlobProps = {
  /** Stable per person. Use the profile id, never the display name. */
  seed: string;
  size?: number;
  /** No face and no hair: an unrevealed seat. */
  faceless?: boolean;
  /** Override the derived hue. Only for cases where the blob must match a surface. */
  color?: string;
  /** Fill for the faceless state. Defaults to ink. */
  facelessFill?: string;
  /** Outline colour. Pass the cream on a dark ground so the silhouette reads. */
  stroke?: string;
  label?: string;
};

export const Blob = memo(function Blob({
  seed,
  size = 72,
  faceless = false,
  color,
  facelessFill,
  stroke = Palette.ink,
  label,
}: BlobProps) {
  const h = hashSeed(seed);
  const silhouette = SILHOUETTES[h % SILHOUETTES.length];
  const fill = faceless ? (facelessFill ?? Palette.ink) : (color ?? BLOB_COLORS[(h >>> 5) % BLOB_COLORS.length]);
  const face = FACES[(h >>> 11) % FACES.length];
  const hair = HAIRS[(h >>> 17) % HAIRS.length];

  return (
    <Svg
      width={size}
      height={size}
      viewBox="-9 -13 118 121"
      accessibilityRole="image"
      accessibilityLabel={label ?? (faceless ? 'Unrevealed seat' : 'Member')}
    >
      <Path d={silhouette} fill={fill} stroke={stroke} strokeWidth={3} />
      {!faceless && face(stroke)}
      {!faceless && hair && <Stroke d={hair} s={stroke} w={3.2} />}
    </Svg>
  );
});
