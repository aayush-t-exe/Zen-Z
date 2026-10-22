import type { StaticImageData } from 'next/image';
import cafes from '@/assets/icons/cafes.webp';
import dinners from '@/assets/icons/dinners.webp';
import movies from '@/assets/icons/movies.webp';
import cricket from '@/assets/icons/cricket.webp';
import football from '@/assets/icons/football.webp';
import pool from '@/assets/icons/pool.webp';
import pickleball from '@/assets/icons/pickleball.webp';

export type Plan = {
  id: string;
  name: string;
  icon: StaticImageData;
  /** What the price line says. `free` renders the red FREE badge. */
  price: { kind: 'free' } | { kind: 'from' | 'flat'; amount: number };
  group: string;
  length: string | null;
  note: string;
  tilt: number;
};

// Prices: Cafés/Dinners free since 2026-09-28 (0101); Movies default ₹126
// (0088, a new release can carry its own price); Sports from PRODUCT_SPEC §1.5a.
export const plans: Plan[] = [
  {
    id: 'cafes',
    name: 'Cafés',
    icon: cafes,
    price: { kind: 'free' },
    group: '4–5 people',
    length: null,
    note: 'Free to book. You pay for your own order.',
    tilt: -2,
  },
  {
    id: 'dinners',
    name: 'Dinners',
    icon: dinners,
    price: { kind: 'free' },
    group: '4–5 people',
    length: null,
    note: 'Free to book. Your budget band, your bill.',
    tilt: 1.5,
  },
  {
    id: 'movies',
    name: 'Movies',
    icon: movies,
    price: { kind: 'from', amount: 126 },
    group: '4–5 people',
    length: null,
    note: 'The ticket is in the price.',
    tilt: -1,
  },
  {
    id: 'cricket',
    name: 'Box Cricket',
    icon: cricket,
    price: { kind: 'flat', amount: 221 },
    group: '10–14 players',
    length: '2 hrs',
    note: 'The turf is in the price.',
    tilt: 2,
  },
  {
    id: 'football',
    name: 'Football',
    icon: football,
    price: { kind: 'flat', amount: 221 },
    group: '8–14 players',
    length: '1 hr',
    note: 'The turf is in the price.',
    tilt: -1.5,
  },
  {
    id: 'pool',
    name: '8-Ball Pool',
    icon: pool,
    price: { kind: 'flat', amount: 70 },
    group: '4 players',
    length: '1 hr',
    note: 'The table is in the price.',
    tilt: 1,
  },
  {
    id: 'pickleball',
    name: 'Pickleball',
    icon: pickleball,
    price: { kind: 'flat', amount: 129 },
    group: '4 players',
    length: '1 hr',
    note: 'The court is in the price.',
    tilt: -2.5,
  },
];

export function priceLabel(p: Plan['price']): string {
  if (p.kind === 'free') return 'Free';
  return p.kind === 'from' ? `from ₹${p.amount}` : `₹${p.amount}`;
}

// The rolling sentence in the hero. First entry of each list is what the server
// renders and what reduced motion keeps.
export const rollingPlans = [
  'a café evening',
  'a movie night',
  'a box cricket game',
  'a pool hour',
  'a dinner',
  'a pickleball hour',
];
export const rollingPeople = [
  '4 people you haven’t met',
  'a table picked by hand',
  'a +1 and 3 new faces',
  'a women-only table',
];

export const steps = [
  {
    title: 'Pick a plan',
    body: 'A café, a dinner, a movie or a game. Then a time that week, a budget, and who you’d rather sit with: mixed, women only or men only.',
    note: 'bring a +1 if you’d rather not walk in alone',
  },
  {
    title: 'Answer a few questions',
    body: 'What you’re into, what you’d argue about, what you’d eat. You answer a few questions. We actually read them.',
    note: 'takes about two minutes',
  },
  {
    title: 'A person builds your table',
    body: 'Someone on our team reads the answers, puts 4 or 5 of you together and picks the place. You see first names and years.',
    note: 'by hand, every single one',
  },
  {
    title: 'Chat opens 48h before',
    body: 'Two days out, the venue and your group chat unlock. Say hi, sort out who’s late. We remind you 2 hours before.',
    note: 'no venue picker, ever',
  },
  {
    title: 'Show up',
    body: 'That’s the whole job. Afterwards, tell us how it went, so the next table is a better one.',
    note: 'that’s it. really.',
  },
];

export const safety = [
  {
    title: 'Your photo stays with us',
    body: 'It helps us build the table. Nobody you meet ever sees it, and the database won’t let them.',
    tone: 'red',
  },
  {
    title: 'Women-only tables',
    body: 'Choose women only when you book. Men-only tables are there too.',
    tone: 'paper',
  },
  {
    title: 'Bring a +1',
    body: 'Add a friend to your booking so you never walk in alone.',
    tone: 'butter',
  },
  {
    title: '18+ only',
    body: 'Your date of birth is checked when you sign up. Under 18 can’t make an account.',
    tone: 'paper',
  },
  {
    title: 'Report from the chat',
    body: 'Report anyone, any time, even after. Once you do, you’re never seated with them again.',
    tone: 'paper',
  },
  {
    title: 'We don’t read your chats',
    body: 'Your group chat is yours. There’s no screen on our side that shows the messages.',
    tone: 'ink',
  },
  {
    title: 'Refund if no group forms',
    body: 'If we can’t build your table, or we cancel, the money comes back automatically.',
    tone: 'butter',
  },
] as const;

// Real question from the app's quiz: question 3, "hot takes" (migrations 0089,
// 0092 and 0095). Shown here as a teaser only; nothing is stored or sent.
export const quizTeaser = {
  prompt: 'Which of these do you actually agree with?',
  hint: 'Pick as many as fit.',
  options: [
    { short: 'plans change, whatever', label: 'Last-minute plan changes don’t really bother me' },
    { short: 'no fixed plan', label: 'Hangouts are more fun with no fixed plan' },
    { short: 'honest > comfy', label: 'I’d rather be honest than comfortable, even if it stings a bit' },
    { short: 'text overthinker', label: 'It’s normal to overthink a text before sending it' },
    { short: 'no click, no reply', label: 'It’s fine to stop replying to someone you don’t click with' },
  ],
};

export const traitPills = [
  'chai over coffee',
  'box cricket regular',
  'quiet till the second hour',
  'will split the fries',
  'thoda late, sorry',
  'here for the dessert',
];

// An illustrative group chat, framed on the page as an example. Not real users.
export const exampleChat = [
  { from: 'zen', text: 'Your table is set. Box Cricket, Sat 6:00 PM. Here’s where you’re meeting.' },
  { from: 'R', name: 'Riya', text: 'hi!! who’s bringing the bat' },
  { from: 'A', name: 'Arjun', text: 'turf has bats I think. I’ll bring the tape ball anyway' },
  { from: 'me', text: 'I’ll be the one in the red hoodie' },
  { from: 'S', name: 'Sana', text: 'running 5 min late, start without me 😭' },
  { from: 'R', name: 'Riya', text: 'we’ll wait. nobody bats first till Sana’s here' },
] as const;

export type Faq = { q: string; a: string };

export const homeFaqs: Faq[] = [
  {
    q: 'Is this a dating app?',
    a: 'No. It’s groups of 4 or 5 (more for sports), never two people. You can pick a women-only or men-only table, and nobody ever sees your photo.',
  },
  {
    q: 'What does it cost?',
    a: 'Cafés and Dinners are free to book; you pay for your own food at the place. Movies are from ₹126. Box Cricket and Football are ₹221, 8-Ball Pool ₹70, Pickleball ₹129. The app shows the final price before you pay. A +1 doubles it.',
  },
  {
    q: 'Who will be at my table?',
    a: 'Students a person on our team picked from the quiz answers. You see their first names and years once the table is set. Venue and group chat open 48 hours before.',
  },
  {
    q: 'Can I bring a friend?',
    a: 'Yes. Add a +1 when you book. They don’t need the app, but they have to be 18+, and they sit at the same table as you.',
  },
  {
    q: 'What if no group forms?',
    a: 'You get a full refund, automatically. Same if we cancel. If you don’t show up, there’s no refund, because the table was built around your seat.',
  },
  {
    q: 'I have an iPhone. Can I use it?',
    a: 'Yes. Open zen-z.site/get-app in Safari and add Zen-Z to your Home Screen. It works like an app. Android gets it on Google Play.',
  },
  {
    q: 'When do I need to book?',
    a: 'Booking for a slot closes at midnight, two days before it. Each activity has a fixed time every week.',
  },
];
