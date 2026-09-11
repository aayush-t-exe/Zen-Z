import { useState } from 'react';
import { Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { FlowFieldButton } from '@/components/flow-panel';

export function formatDob(date: Date) {
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function defaultDob() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 18);
  return date;
}

interface DobFieldProps {
  value: Date | null;
  onChange: (date: Date) => void;
  maxDate: Date;
  contentWidth: number;
}

/**
 * iOS/Android date-of-birth entry — the native picker, exactly as it
 * behaved inside profile-creation.tsx before this was split out for a web
 * counterpart (see dob-field.web.tsx). Android needs the button-then-dialog
 * two-step since its picker is a modal, not an inline control like iOS's
 * spinner.
 */
export function DobField({ value, onChange, maxDate, contentWidth }: DobFieldProps) {
  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === 'ios');

  const handleDateValueChange = (_event: any, selected: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    onChange(selected);
  };

  const handleDateDismiss = () => {
    if (Platform.OS === 'android') setShowDatePicker(false);
  };

  return (
    <>
      {Platform.OS === 'android' && !showDatePicker && (
        <FlowFieldButton
          width={contentWidth}
          value={value ? formatDob(value) : null}
          placeholder="Choose your date of birth"
          onPress={() => setShowDatePicker(true)}
        />
      )}
      {showDatePicker && (
        <DateTimePicker
          value={value ?? defaultDob()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={maxDate}
          onValueChange={handleDateValueChange}
          onDismiss={handleDateDismiss}
          themeVariant="dark"
        />
      )}
    </>
  );
}
