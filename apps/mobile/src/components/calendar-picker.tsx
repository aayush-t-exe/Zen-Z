import { useState } from 'react';
import { View, Text, Pressable, Image, ScrollView, StyleSheet } from 'react-native';

import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FlowSurface, FlowText } from '@/constants/flow-theme';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Matches the primary pill's near-white — reused here as the selected day/year fill. */
const SELECTED_FILL = '#FFFDF8';

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(a: Date, b: Date) {
  return a.getTime() === b.getTime();
}

interface CalendarPickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  maxDate: Date;
  /** Defaults to 80 years before `maxDate` — generous enough for any student without making the year list unusable. */
  minDate?: Date;
  width: number;
}

/**
 * A month-grid date picker drawn in the flow's own dark/cream style, in
 * place of the phone's stock system date dialog (the old dob-field.tsx,
 * reported live as looking dated on Android). Coded rather than drawn from
 * the panel art, the same reasoning as OptionChip — a day cell is far too
 * small for the 902x154 row art to stretch into without its corners going
 * elliptical.
 *
 * Picking a day is the only way out: there's no separate "confirm" step, so
 * the caller (DobField) closes its sheet the instant `onChange` fires.
 */
export function CalendarPicker({ value, onChange, maxDate, minDate, width }: CalendarPickerProps) {
  const max = startOfDay(maxDate);
  const min = startOfDay(minDate ?? new Date(maxDate.getFullYear() - 80, maxDate.getMonth(), maxDate.getDate()));
  const initial = value ? startOfDay(value) : max;

  const [viewedYear, setViewedYear] = useState(initial.getFullYear());
  const [viewedMonth, setViewedMonth] = useState(initial.getMonth());
  const [showYearPicker, setShowYearPicker] = useState(false);

  const today = startOfDay(new Date());
  const atMinMonth = viewedYear === min.getFullYear() && viewedMonth === min.getMonth();
  const atMaxMonth = viewedYear === max.getFullYear() && viewedMonth === max.getMonth();

  const goPrevMonth = () => {
    if (atMinMonth) return;
    if (viewedMonth === 0) {
      setViewedYear((y) => y - 1);
      setViewedMonth(11);
    } else {
      setViewedMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (atMaxMonth) return;
    if (viewedMonth === 11) {
      setViewedYear((y) => y + 1);
      setViewedMonth(0);
    } else {
      setViewedMonth((m) => m + 1);
    }
  };

  const cellSize = Math.floor(width / 7);
  const dayDiameter = Math.min(cellSize - 8, 40);

  if (showYearPicker) {
    // Newest first — a student's likely birth year (close to `max`) sits at
    // the top instead of scrolled 80 rows deep in a chronological list.
    const years: number[] = [];
    for (let y = max.getFullYear(); y >= min.getFullYear(); y--) years.push(y);

    return (
      <View style={{ width }}>
        <Text style={styles.headerLabel}>Choose a year</Text>
        <ScrollView style={styles.yearScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.yearGrid}>
            {years.map((year) => (
              <Pressable
                key={year}
                onPress={() => {
                  setViewedYear(year);
                  setShowYearPicker(false);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${year}`}
                style={[styles.yearChip, year === viewedYear && styles.yearChipSelected]}>
                <Text style={[styles.yearChipLabel, year === viewedYear && styles.yearChipLabelSelected]}>
                  {year}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  const firstWeekday = new Date(viewedYear, viewedMonth, 1).getDay();
  const daysInMonth = new Date(viewedYear, viewedMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <View style={{ width }}>
      <View style={styles.header}>
        <Pressable
          onPress={goPrevMonth}
          disabled={atMinMonth}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          style={{ opacity: atMinMonth ? 0.3 : 1 }}>
          <Image
            source={require('@/assets/images/icon-chevron-right.png')}
            style={[styles.chevron, styles.chevronLeft]}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </Pressable>
        <Pressable onPress={() => setShowYearPicker(true)} hitSlop={8} accessibilityRole="button">
          <Text style={styles.headerLabel}>
            {MONTH_LABELS[viewedMonth]} {viewedYear}
          </Text>
        </Pressable>
        <Pressable
          onPress={goNextMonth}
          disabled={atMaxMonth}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          style={{ opacity: atMaxMonth ? 0.3 : 1 }}>
          <Image
            source={require('@/assets/images/icon-chevron-right.png')}
            style={styles.chevron}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, i) => (
          <View key={i} style={{ width: cellSize, alignItems: 'center' }}>
            <Text style={styles.weekdayLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.dayGrid}>
        {cells.map((day, i) => {
          if (day === null) {
            return <View key={`blank-${i}`} style={{ width: cellSize, height: cellSize }} />;
          }

          const cellDate = startOfDay(new Date(viewedYear, viewedMonth, day));
          const disabled = cellDate.getTime() > max.getTime() || cellDate.getTime() < min.getTime();
          const selected = value ? sameDay(cellDate, startOfDay(value)) : false;
          const isToday = sameDay(cellDate, today);

          return (
            <Pressable
              key={day}
              disabled={disabled}
              onPress={() => onChange(cellDate)}
              accessibilityRole="button"
              accessibilityLabel={cellDate.toDateString()}
              accessibilityState={{ selected, disabled }}
              style={{ width: cellSize, height: cellSize, alignItems: 'center', justifyContent: 'center' }}>
              <View
                style={[
                  { width: dayDiameter, height: dayDiameter, borderRadius: dayDiameter / 2 },
                  styles.dayCircle,
                  selected && styles.dayCircleSelected,
                  isToday && !selected && styles.dayCircleToday,
                ]}>
                <Text style={[styles.dayLabel, disabled && styles.dayLabelDisabled, selected && styles.dayLabelSelected]}>
                  {day}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerLabel: {
    ...FlowText.panelLabel,
    fontSize: 16,
    textAlign: 'center',
  },
  chevron: {
    width: 9,
    height: 9 * (47 / 27),
  },
  chevronLeft: {
    transform: [{ scaleX: -1 }],
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekdayLabel: {
    ...FlowText.sectionLabel,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: {
    backgroundColor: SELECTED_FILL,
  },
  dayCircleToday: {
    borderWidth: 1,
    borderColor: FlowSurface.stroke,
  },
  dayLabel: {
    ...FlowText.panelLabel,
    fontSize: 14,
  },
  dayLabelDisabled: {
    color: Palette.muted,
    opacity: 0.4,
  },
  dayLabelSelected: {
    color: FlowSurface.ink,
  },
  yearScroll: {
    maxHeight: 260,
    marginTop: 16,
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 4,
  },
  yearChip: {
    backgroundColor: FlowSurface.fill,
    borderWidth: 1,
    borderColor: FlowSurface.stroke,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  yearChipSelected: {
    backgroundColor: SELECTED_FILL,
    borderColor: SELECTED_FILL,
  },
  yearChipLabel: {
    ...FlowText.panelLabel,
    fontSize: 14,
  },
  yearChipLabelSelected: {
    color: FlowSurface.ink,
  },
});
