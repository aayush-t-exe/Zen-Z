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

// Cafés and Dinners run in the evening every week — showing the exact clock
// time (5pm vs 7pm) reads as an operational schedule, not an invitation.
// Movies runs on a fixed showing per slot, so even "Evening" is redundant —
// just the day is enough. Sports (and anything else) keeps the exact time
// since games are booked at specific, varying hours.
export function formatSlotDateTime(dateString: string, activityName?: string): string {
  const date = new Date(dateString);
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayName = daysOfWeek[date.getDay()];
  const dayNum = date.getDate();
  const dayLabel = `${dayName}, ${dayNum}${getOrdinalSuffix(dayNum)}`;

  if (activityName === 'Movies') return dayLabel;
  if (activityName === 'Cafés' || activityName === 'Dinners') return `${dayLabel} · Evening`;

  const time = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${dayLabel} · ${time}`;
}

export function formatDuration(minutes: number): string {
  if (minutes % 60 === 0) {
    const hrs = minutes / 60;
    return `${hrs} hr${hrs > 1 ? 's' : ''}`;
  }
  return `${minutes} min`;
}
