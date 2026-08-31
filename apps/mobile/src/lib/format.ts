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

// Movies varies which theater/showing the founder assigns at match time, so
// even the slot's own fixed hour isn't the real showtime — just the day is
// shown. Every other activity (Cafés, Dinners, Sports, ...) runs at a real,
// fixed, already-known hour, so the exact clock time is shown for all of them.
export function formatSlotDateTime(dateString: string, activityName?: string): string {
  const date = new Date(dateString);
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayName = daysOfWeek[date.getDay()];
  const dayNum = date.getDate();
  const dayLabel = `${dayName}, ${dayNum}${getOrdinalSuffix(dayNum)}`;

  if (activityName === 'Movies') return dayLabel;

  const time = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${dayLabel} · ${time}`;
}

// Once the venue is revealed the mystery is over — a matched student needs
// to know exactly when to show up, so (unlike formatSlotDateTime) this
// always includes the actual clock time regardless of activity.
export function formatEventTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function formatDuration(minutes: number): string {
  if (minutes % 60 === 0) {
    const hrs = minutes / 60;
    return `${hrs} hr${hrs > 1 ? 's' : ''}`;
  }
  return `${minutes} min`;
}
