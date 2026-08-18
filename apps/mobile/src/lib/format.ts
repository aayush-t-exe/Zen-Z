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

export function formatDuration(minutes: number): string {
  if (minutes % 60 === 0) {
    const hrs = minutes / 60;
    return `${hrs} hr${hrs > 1 ? 's' : ''}`;
  }
  return `${minutes} min`;
}
