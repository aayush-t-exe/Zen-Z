import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FontFamily } from '@/constants/fonts';
import { ScaleQuestionSlider } from '@/components/scale-question-slider';

const STOPS = [
  { label: 'Introverted', description: 'I prefer smaller groups or one-on-one conversations.' },
  { label: 'Ambiverted', description: 'I enjoy both, it depends on the moment.' },
  { label: 'Extroverted', description: 'I love being around people, it gives me energy.' },
];

export default function DebugPreview() {
  const [zone, setZone] = useState<number | undefined>(1);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>What&apos;s your social energy like?</Text>
      <View style={{ flex: 1, justifyContent: 'center', width: '100%' }}>
        <ScaleQuestionSlider stops={STOPS} value={zone} onChange={setZone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Palette.canvas,
    padding: 20,
    paddingTop: 56,
  },
  title: {
    color: Palette.text,
    fontSize: 25,
    fontWeight: '700',
    fontFamily: FontFamily.display.bold,
  },
});
