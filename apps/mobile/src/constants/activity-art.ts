import type { ImageSourcePropType } from 'react-native';

/**
 * The founder's 3D render for every bookable thing — the four home
 * categories and the four Sports games — in one place, because four screens
 * need the same picture for the same activity: the Home grid, the Sports
 * game grid, the booking flow's summary card and the payment summary.
 *
 * Keys are `activity_types.name` verbatim, which is what every one of those
 * screens has in hand. A Sports booking carries the specific game's name (not
 * "Sports"), so the games need their own entries or those screens come up
 * blank.
 *
 * These replace the earlier cream line-illustration set (icon-cafes.png and
 * friends) that the pre-redesign screens drew — the redesign's comps sit the
 * renders on a dark badge, and the illustrations read as a different icon
 * language beside them.
 */
export const ACTIVITY_ART: Record<string, ImageSourcePropType> = {
  Cafés: require('@/assets/images/icon-cafes-photo.png'),
  Dinners: require('@/assets/images/icon-dinners-photo.png'),
  Movies: require('@/assets/images/icon-movies-photo.png'),
  Sports: require('@/assets/images/icon-sports-photo.png'),
  'Box Cricket': require('@/assets/images/icon-cricket-photo.png'),
  Football: require('@/assets/images/icon-football-photo.png'),
  '8-Ball Pool': require('@/assets/images/icon-pool-photo.png'),
  Pickleball: require('@/assets/images/icon-pickleball-photo.png'),
};

/**
 * A game added in data (the point of `activity_types` being a table) has no
 * render yet, so it falls back to the generic Sports one rather than drawing
 * an empty badge.
 */
export const activityArt = (name: string | null | undefined): ImageSourcePropType =>
  (name ? ACTIVITY_ART[name] : undefined) ?? ACTIVITY_ART.Sports;

/**
 * How much of the badge circle the render fills, wherever one of these sits in
 * a badge that isn't Home's own card — the summary card's activity row, and
 * the payment screen's.
 *
 * A touch fuller than the Home comp's 0.7, because these badges are a third
 * the size and sit in a column with the comp's own line glyphs: at 0.7 a
 * render with a diagonal subject (the cricket bat, the pickleball paddle) read
 * visibly lighter than the filled star and group marks beside it.
 */
export const ACTIVITY_ART_BADGE_SCALE = 0.78;
