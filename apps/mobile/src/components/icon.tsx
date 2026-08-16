/**
 * The Zen-Z icon set.
 *
 * Drawn in-house rather than pulled from a library. Two reasons: every
 * off-the-shelf set carries its own stroke personality that fights the
 * 2.5px outline system, and the one already in the app (Feather) is
 * Lucide's direct ancestor and reads exactly like it. Eighteen icons is
 * a small enough surface to own outright, and owning it means the whole
 * set matches the blob artwork by construction.
 *
 * Grid: 24x24, stroke 2.2, round caps and joins, no fills. Activity
 * glyphs share the grid so they can sit inline with the rest at the same
 * optical weight.
 */

import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { Palette } from '@/constants/theme';

/** Glyphs inherit stroke and width from the parent <Svg>, so they take no args. */
type Glyph = () => React.ReactNode;

const P = (d: string, key?: string, dash?: string) => (
  <Path key={key ?? d} d={d} strokeDasharray={dash} />
);
const C = (cx: number, cy: number, r: number) => <Circle key={`c${cx}${cy}${r}`} cx={cx} cy={cy} r={r} />;
const R = (x: number, y: number, w: number, h: number) => (
  <Rect key={`r${x}${y}`} x={x} y={y} width={w} height={h} />
);

const GLYPHS = {
  // --- activities, keyed to activity_types.icon_key ---
  cafe: () => (
    <>
      {P('M5 8h12v5a6 6 0 0 1-12 0z')}
      {P('M17 10c3 0 3.8 1.5 3.8 3s-.8 3-3.8 3')}
      {P('M9 2q1.6 1.6 0 3.4')}
      {P('M13 2q1.6 1.6 0 3.4')}
    </>
  ),
  dinner: () => (
    <>
      {P('M4.5 17a7.5 7.5 0 0 1 15 0z')}
      {P('M2.5 17h19')}
      {C(12, 6.6, 1.6)}
    </>
  ),
  movie: () => (
    <>
      {P('M4 8h16v3.5a2 2 0 0 0 0 4V19H4v-3.5a2 2 0 0 0 0-4z')}
      {P('M15.5 9.5v9', 'perf', '2.6 2.6')}
    </>
  ),

  // --- navigation ---
  home: () => (
    <>
      {P('M3.5 10.5 12 3.5l8.5 7V20.5h-17z')}
      {P('M9.5 20.5v-6h5v6')}
    </>
  ),
  calendar: () => (
    <>
      {R(3.5, 5, 17, 15)}
      {P('M3.5 10h17')}
      {P('M8 3v4')}
      {P('M16 3v4')}
    </>
  ),
  chat: () => P('M3.5 5h17v11H9l-5.5 4z'),
  profile: () => (
    <>
      {C(12, 8.5, 4)}
      {P('M4.5 20.5c0-4.1 3.4-6.8 7.5-6.8s7.5 2.7 7.5 6.8')}
    </>
  ),

  // --- utility ---
  back: () => P('M15 4.5 7.5 12 15 19.5'),
  forward: () => P('M9 4.5 16.5 12 9 19.5'),
  close: () => (
    <>
      {P('M6 6 18 18')}
      {P('M18 6 6 18')}
    </>
  ),
  check: () => P('M4.5 12.5 9.5 17.5 19.5 6.5'),
  plus: () => (
    <>
      {P('M12 5v14')}
      {P('M5 12h14')}
    </>
  ),
  send: () => (
    <>
      {P('M20.5 3.5 3.5 10l7 3.2 3.2 7z')}
      {P('M20.5 3.5 10.5 13.2')}
    </>
  ),
  bell: () => (
    <>
      {P('M7 10a5 5 0 0 1 10 0c0 4.5 1.5 6 1.5 6h-13S7 14.5 7 10z')}
      {P('M10 19.4a2.2 2.2 0 0 0 4 0')}
    </>
  ),
  lock: () => (
    <>
      {R(4.5, 10.5, 15, 9)}
      {P('M8 10.5v-3a4 4 0 0 1 8 0v3')}
    </>
  ),
  clock: () => (
    <>
      {C(12, 12, 8.5)}
      {P('M12 7v5.2l3.3 2')}
    </>
  ),
  pin: () => (
    <>
      {P('M12 21.5s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z')}
      {C(12, 10.4, 2.6)}
    </>
  ),
  group: () => (
    <>
      {C(9, 8.5, 3.8)}
      {P('M2.5 20c0-3.6 2.9-5.8 6.5-5.8s6.5 2.2 6.5 5.8')}
      {P('M16.4 5.3a3.8 3.8 0 0 1 0 6.6')}
      {P('M17.6 14.6c2.5.6 3.9 2.5 3.9 5.4')}
    </>
  ),
  flag: () => (
    <>
      {P('M6 21.5V3.5')}
      {P('M6 4.5h12l-2.5 4 2.5 4H6')}
    </>
  ),
  camera: () => (
    <>
      {R(3, 7, 18, 13)}
      {C(12, 13.5, 4)}
      {P('M9 7l1.5-3h3L15 7')}
    </>
  ),
  warning: () => (
    <>
      {P('M12 3.5 21.5 20h-19z')}
      {P('M12 10v4.6')}
      {P('M12 17.6v.4')}
    </>
  ),
} satisfies Record<string, Glyph>;

export type IconName = keyof typeof GLYPHS;

export type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  /** Slightly heavier stroke for large standalone use. */
  weight?: number;
};

export function Icon({ name, size = 24, color = Palette.ink, weight = 2.2 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {GLYPHS[name]()}
    </Svg>
  );
}

/**
 * Only these keys resolve to an activity glyph. A key with no glyph (an
 * activity added to the table before its artwork exists, or a missing
 * join) renders nothing rather than borrowing another activity's mark,
 * which would quietly mislabel it.
 */
const ACTIVITY_KEYS = ['cafe', 'dinner', 'movie'] as const;

/** Activity glyph resolved from `activity_types.icon_key`. */
export function ActivityIcon({
  iconKey,
  size = 24,
  color = Palette.ink,
  weight = 2.2,
}: { iconKey: string } & Omit<IconProps, 'name'>) {
  if (!(ACTIVITY_KEYS as readonly string[]).includes(iconKey)) return null;
  return <Icon name={iconKey as IconName} size={size} color={color} weight={weight} />;
}

export function isIconName(value: string): value is IconName {
  return value in GLYPHS;
}
