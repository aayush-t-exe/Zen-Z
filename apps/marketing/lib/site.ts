// Every fact the site states about Zen-Z lives here or in lib/content.ts, so a
// price or a number changes in one place. Sources: docs/PRODUCT_SPEC.md and the
// migrations (newest wins), plus the proof Aayush confirmed for the brief.

export const site = {
  name: 'Zen-Z',
  url: 'https://zen-z.site',
  title: 'Zen-Z: a table of new people at JNU Jaipur',
  description:
    'Pick a plan, answer a few questions, and a person on our team puts you at a table of 4 or 5 students you haven’t met. Cafés and dinners are free to book. Live at JNU Jaipur.',
  campus: 'JNU Jaipur',
  campusLong: 'Jaipur National University, Jagatpura',
};

export const links = {
  // The Play listing itself. /get-app adds &hl=en when it redirects Android scans.
  play: 'https://play.google.com/store/apps/details?id=com.campussocial.app',
  getApp: '/get-app',
  getAppAbsolute: 'https://zen-z.site/get-app',
  instagram: 'https://www.instagram.com/zen_z.app',
  instagramHandle: '@zen_z.app',
  instagramDm: 'https://ig.me/m/zen_z.app',
  email: 'teamzenz003@gmail.com',
};

// The legal operator block PayU and Google Play check for. Keep it on every page.
export const operator = {
  name: 'Dhruv Goyal',
  kind: 'Individual / unregistered project',
  address: 'A-21, Anand Vihar, Railway Colony, Jagatpura, Jaipur, Rajasthan – 302017, India',
  email: 'teamzenz003@gmail.com',
  phones: ['9460623157', '7069183086'],
};

export const proof = {
  launchStudents: '150+',
  instagramViews: '140K+',
  instagramFollowers: '550+',
};

/**
 * How many tables the team can build in a week. Left null until Aayush
 * confirms the current number ([CONFIRM]); while null the site says it without
 * a figure. Set to e.g. '10 to 20' and the founder note picks it up.
 */
export const tablesPerWeek: string | null = null;

export const legalLinks = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/refund', label: 'Refunds' },
  { href: '/community-guidelines', label: 'Community Guidelines' },
  { href: '/delete-account', label: 'Delete Account' },
];

export const pageLinks = [
  { href: '/about', label: 'About' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
];
