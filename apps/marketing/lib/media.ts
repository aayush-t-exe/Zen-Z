/**
 * Slots for media that doesn't exist yet. Each one is a single edit here.
 *
 * 1. The app screen recording. While `zenzDemo` is null the hero phone cycles the
 *    real screenshots in assets/screens. To switch to the video, add the files to
 *    public/media/ and set:
 *
 *      export const zenzDemo = {
 *        mp4: '/media/zenz-demo.mp4',
 *        webm: '/media/zenz-demo.webm',
 *        poster: '/media/zenz-demo-poster.jpg',
 *      };
 *
 *    It plays muted, inline and looped, and never autoplays under reduced motion.
 *
 * 2. Real meetup photos. None exist yet, and we don't fake them. When there are
 *    some (with everyone's permission), put them in public/media/tables/ and list
 *    them in `tablePhotos`; the "photo wall" strip above the closing section
 *    appears on its own once the list has at least three entries.
 *
 * 3. The founder photo is assets/founder/portrait.jpg. Replace the file (any
 *    4:5 portrait) to swap it.
 */
export const zenzDemo: null | { mp4: string; webm?: string; poster: string } = null;

export const tablePhotos: { src: string; alt: string; width: number; height: number }[] = [];
