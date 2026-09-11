import { FlowSurfaceBox, flowRowHeight } from '@/components/flow-panel';
import { FontFamily } from '@/constants/fonts';

export function formatDob(date: Date) {
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

// `@react-native-community/datetimepicker` ships no web build at all (no
// `.web.*` entry point in the package) — this is the browser's own native
// date input standing in for it, styled onto the same field surface every
// other row in this flow uses.
function toInputValue(date: Date | null): string {
  if (!date) return '';
  return date.toISOString().slice(0, 10);
}

// yyyy-mm-dd out of the input, parsed as local midnight rather than
// `new Date(string)`'s UTC-midnight parse — matching what the native picker
// hands back on iOS/Android, so the ≥18 check against maxDate compares like
// with like on every platform.
function fromInputValue(value: string): Date | null {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

interface DobFieldProps {
  value: Date | null;
  onChange: (date: Date) => void;
  maxDate: Date;
  contentWidth: number;
}

export function DobField({ value, onChange, maxDate, contentWidth }: DobFieldProps) {
  return (
    <FlowSurfaceBox width={contentWidth} height={flowRowHeight(contentWidth)}>
      <input
        type="date"
        value={toInputValue(value)}
        max={toInputValue(maxDate)}
        onChange={(event) => {
          const parsed = fromInputValue(event.target.value);
          if (parsed) onChange(parsed);
        }}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: '#FFFFFF',
          fontSize: 17,
          fontFamily: FontFamily.accent.sfProDisplayMedium,
          paddingLeft: 24,
          paddingRight: 24,
          colorScheme: 'dark',
        }}
      />
    </FlowSurfaceBox>
  );
}
