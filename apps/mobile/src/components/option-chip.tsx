import { useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FontFamily } from '@/constants/fonts';

/**
 * Compact multi-select chip for grid-style questions (e.g. hobbies). Wrap a
 * row of these in a flex-wrap View — sizing is intrinsic to the label.
 */
export function OptionChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}>
      <View style={[styles.chip, selected && styles.chipSelected, pressed && styles.chipPressed]}>
        <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 2,
    borderColor: Palette.ring,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  chipSelected: {
    backgroundColor: Palette.paper,
    borderColor: Palette.paper,
  },
  chipPressed: {
    opacity: 0.82,
  },
  label: {
    color: Palette.text,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FontFamily.body.semiBold,
  },
  labelSelected: {
    color: Palette.line,
  },
});
