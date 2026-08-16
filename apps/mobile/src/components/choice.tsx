/**
 * Radio and checkbox rows.
 *
 * These replace the `○` / `☑` / `☐` text characters the quiz and booking
 * flow were using as stand-in controls. Those never aligned with their
 * labels, could not show a pressed state, and were invisible to screen
 * readers as controls. Drawing them means they also match the outline
 * system instead of whatever the platform font happened to render.
 */

import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Fonts, OUTLINE_WIDTH, Palette, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ChoiceProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  /** Secondary line under the label, e.g. an explanation of why an option is unavailable. */
  hint?: string;
};

function ChoiceRow({
  label,
  selected,
  onPress,
  disabled,
  hint,
  children,
}: ChoiceProps & { children: React.ReactNode }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: hint ? 'flex-start' : 'center',
        gap: 13,
        paddingVertical: 14,
        paddingHorizontal: 15,
        borderWidth: OUTLINE_WIDTH,
        borderColor: selected ? Palette.ink : theme.outline,
        borderRadius: Radius.card,
        backgroundColor: selected ? Palette.marigold : 'transparent',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
      <View style={{ flex: 1, gap: 3 }}>
        <Text
          style={{
            fontFamily: selected ? Fonts.bodySemi : Fonts.body,
            fontSize: 15,
            lineHeight: 21,
            color: selected ? Palette.ink : theme.text,
          }}
        >
          {label}
        </Text>
        {hint && (
          <Text
            style={{
              fontFamily: Fonts.body,
              fontSize: 13,
              lineHeight: 18,
              color: selected ? Palette.ink : theme.textSecondary,
            }}
          >
            {hint}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export function Radio(props: ChoiceProps) {
  const theme = useTheme();
  const ring = props.selected ? Palette.ink : theme.outline;

  return (
    <ChoiceRow {...props}>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: Radius.pill,
          borderWidth: OUTLINE_WIDTH,
          borderColor: ring,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: props.hint ? 1 : 0,
        }}
      >
        {props.selected && (
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: Radius.pill,
              backgroundColor: Palette.ink,
            }}
          />
        )}
      </View>
    </ChoiceRow>
  );
}

export function Checkbox(props: ChoiceProps) {
  const theme = useTheme();

  return (
    <ChoiceRow {...props}>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: Radius.card,
          borderWidth: OUTLINE_WIDTH,
          borderColor: props.selected ? Palette.ink : theme.outline,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: props.hint ? 1 : 0,
        }}
      >
        {props.selected && <Icon name="check" size={14} color={Palette.ink} weight={3.2} />}
      </View>
    </ChoiceRow>
  );
}
