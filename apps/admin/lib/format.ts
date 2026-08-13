export function formatBudget(band: string): string {
  const budgets: Record<string, string> = {
    // Current bands (apps/mobile/src/app/(home)/booking-flow.tsx).
    under_200: 'Under ₹200',
    '200_400': '₹200–400',
    '400_plus': '₹400+',
    // Bands used by any booking created before that budget range changed.
    under_300: 'Under ₹300',
    '300_600': '₹300–600',
    '600_plus': '₹600+',
  };
  return budgets[band] || band;
}

export function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

export function formatSlotDateTime(dateString: string): string {
  const date = new Date(dateString);
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayName = daysOfWeek[date.getDay()];
  const dayNum = date.getDate();
  const time = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${dayName}, ${dayNum}${getOrdinalSuffix(dayNum)} · ${time}`;
}
