import { getOrdinalSuffix, formatSlotDateTime } from './format';

describe('getOrdinalSuffix', () => {
  it('uses "st" for 1', () => {
    expect(getOrdinalSuffix(1)).toBe('st');
  });

  it('uses "nd" for 2', () => {
    expect(getOrdinalSuffix(2)).toBe('nd');
  });

  it('uses "rd" for 3', () => {
    expect(getOrdinalSuffix(3)).toBe('rd');
  });

  it('uses "th" for 4', () => {
    expect(getOrdinalSuffix(4)).toBe('th');
  });

  it.each([11, 12, 13])('uses "th" for the 11-13 teens exception (%i)', (day) => {
    expect(getOrdinalSuffix(day)).toBe('th');
  });

  it.each([21, 22, 23])('resumes st/nd/rd after the teens exception (%i)', (day) => {
    expect(getOrdinalSuffix(day)).toBe(['st', 'nd', 'rd'][day - 21]);
  });

  it('uses "th" for 0', () => {
    expect(getOrdinalSuffix(0)).toBe('th');
  });
});

describe('formatSlotDateTime', () => {
  it('formats a date as "Day, Nth · time"', () => {
    // 2026-08-09 is a Sunday.
    const result = formatSlotDateTime('2026-08-09T19:30:00');
    expect(result).toMatch(/^Sun, 9th · /);
  });

  it('uses the correct ordinal suffix for the day of month', () => {
    // 2026-08-11 is a Tuesday, day 11 -> teens exception.
    const result = formatSlotDateTime('2026-08-11T09:00:00');
    expect(result).toMatch(/^Tue, 11th · /);
  });

  it('shows "Evening" instead of a clock time for Cafés', () => {
    const result = formatSlotDateTime('2026-08-09T19:30:00', 'Cafés');
    expect(result).toBe('Sun, 9th · Evening');
  });

  it('shows "Evening" instead of a clock time for Dinners', () => {
    const result = formatSlotDateTime('2026-08-11T17:00:00', 'Dinners');
    expect(result).toBe('Tue, 11th · Evening');
  });

  it('drops the time entirely for Movies, leaving just the day', () => {
    const result = formatSlotDateTime('2026-08-09T19:30:00', 'Movies');
    expect(result).toBe('Sun, 9th');
  });

  it('keeps the exact clock time for activities without a special case (e.g. Sports)', () => {
    const result = formatSlotDateTime('2026-08-09T19:30:00', 'Football');
    expect(result).toMatch(/^Sun, 9th · /);
  });
});
