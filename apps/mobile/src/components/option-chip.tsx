import { useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';

import { FlowSurface, FlowText } from '@/constants/flow-theme';

/**
 * Compact multi-select chip for grid-style questions (e.g. hobbies). Wrap a
 * row of these in a flex-wrap View — sizing is intrinsic to the label.
 *
 * The only surface in the redesign that is coded rather than drawn from the
 * panel art: stretching a 902x154 box down to chip proportions turns its
 * rounded corners elliptical, so this matches the art's fill and stroke by
 * value instead (see FlowSurface for why `stroke` is dimmer than the art's
 * literal top edge). Selected chips take the primary pill's near-white fill
 * rather than a tick — there is no room for one at this size.
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

/** The primary pill art samples #FFFDF8 flat — matched here so the two read as one surface. */
const SELECTED_FILL = '#FFFDF8';

const styles = StyleSheet.create({
  chip: {
    backgroundColor: FlowSurface.fill,
    borderWidth: 1,
    borderColor: FlowSurface.stroke,
    borderRadius: 22,
    paddingVertical: 11,
    paddingHorizontal: 18,
  },
  chipSelected: {
    backgroundColor: SELECTED_FILL,
    borderColor: SELECTED_FILL,
  },
  chipPressed: {
    opacity: 0.82,
  },
  label: {
    ...FlowText.panelLabel,
    fontSize: 15,
  },
  labelSelected: {
    color: FlowSurface.ink,
  },
});
