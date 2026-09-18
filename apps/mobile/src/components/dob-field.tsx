import { useState } from 'react';
import { Text, Modal, Pressable, StyleSheet, useWindowDimensions } from 'react-native';

import { FlowFieldButton } from '@/components/flow-panel';
import { CalendarPicker } from '@/components/calendar-picker';
import { FlowSurface, FlowText } from '@/constants/flow-theme';

export function formatDob(date: Date) {
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

interface DobFieldProps {
  value: Date | null;
  onChange: (date: Date) => void;
  maxDate: Date;
  contentWidth: number;
}

/**
 * Date-of-birth entry — a calendar drawn in the flow's own dark/cream style,
 * in a centred sheet, rather than the phone's stock system date dialog this
 * used to open (reported live as looking dated on Android). Built from
 * plain Views/Pressables rather than a native module, so unlike the old
 * split here, one component now covers iOS, Android and web alike — no
 * `.web.tsx` counterpart needed.
 */
export function DobField({ value, onChange, maxDate, contentWidth }: DobFieldProps) {
  const [open, setOpen] = useState(false);
  const { width: screenWidth } = useWindowDimensions();
  const sheetWidth = Math.min(contentWidth, screenWidth - 48);

  return (
    <>
      <FlowFieldButton
        width={contentWidth}
        value={value ? formatDob(value) : null}
        placeholder="Choose your date of birth"
        onPress={() => setOpen(true)}
      />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          {/* Swallows the tap so it doesn't fall through to the overlay's own onPress and close the sheet mid-pick. */}
          <Pressable style={[styles.sheet, { width: sheetWidth }]} onPress={() => {}}>
            <Text style={styles.title}>When&apos;s your birthday?</Text>
            <CalendarPicker
              value={value}
              onChange={(date) => {
                onChange(date);
                setOpen(false);
              }}
              maxDate={maxDate}
              width={sheetWidth - 48}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 24,
  },
  sheet: {
    backgroundColor: '#0A0A0A',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: FlowSurface.stroke,
    padding: 24,
  },
  title: {
    ...FlowText.titleCompact,
    fontSize: 19,
    marginBottom: 20,
    textAlign: 'center',
  },
});
