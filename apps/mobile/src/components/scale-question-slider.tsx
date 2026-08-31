import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  interpolate,
  interpolateColor,
  Extrapolation,
  ReduceMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FontFamily } from '@/constants/fonts';
import { PersonalityMascot, MASCOT_STOP_POSITIONS, MASCOT_TO_COLORS } from '@/components/personality-mascot';

const THUMB_SIZE = 28;
const TRACK_HEIGHT = 22;
const BOUNDARY_BLEND = 0.07;
// Apple-style duration+dampingRatio spring — perceptual duration is ~2/3 of
// actual settle time, and dampingRatio < 1 leaves a small, deliberate
// overshoot so the stop feels caught, not just stopped.
const SNAP_SPRING = { duration: 450, dampingRatio: 0.75, reduceMotion: ReduceMotion.Never };
// How far (in track-width fractions per second of velocity) a fast flick
// projects ahead of the raw release point before picking the nearest stop —
// a quick flick can jump a stop the finger never actually reached.
const VELOCITY_PROJECTION = 0.12;

export interface ScaleStop {
  label: string;
  description: string;
}

/**
 * The full scale-question interaction: mascot + crossfading copy + a
 * draggable track with discrete stops. Reusable across every scale-type
 * quiz question — pass however many stops that question defines.
 *
 * The mascot's gradient and the sparkle accents track drag position
 * continuously (see PersonalityMascot); only the label/description text is
 * zone-based, crossfading in the narrow window around each boundary rather
 * than blending the whole way across.
 */
export function ScaleQuestionSlider({
  stops,
  value,
  onChange,
  accessibilityLabel = 'Slide to answer',
}: {
  stops: ScaleStop[];
  value?: number;
  onChange: (zone: number) => void;
  accessibilityLabel?: string;
}) {
  const stopCount = stops.length;
  const initialProgress = value !== undefined ? value / (stopCount - 1) : 0.5;

  const progress = useSharedValue(initialProgress);
  const trackWidth = useSharedValue(0);
  const pressed = useSharedValue(0);
  const [trackWidthState, setTrackWidthState] = useState(0);

  useEffect(() => {
    if (value === undefined) return;
    const target = value / (stopCount - 1);
    progress.value = withSpring(target, SNAP_SPRING);
  }, [value, stopCount, progress]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    trackWidth.value = width;
    setTrackWidthState(width);
  };

  const snapToNearest = (rawProgress: number, velocityX: number) => {
    'worklet';
    const width = trackWidth.value;
    const projected = width > 0 ? rawProgress + (velocityX / width) * VELOCITY_PROJECTION : rawProgress;
    const clamped = Math.min(1, Math.max(0, projected));
    const zone = Math.round(clamped * (stopCount - 1));
    // react-hooks/immutability doesn't know Reanimated SharedValues are meant
    // to be mutated imperatively from effects, worklets, and gesture
    // callbacks alike — that's the real Reanimated API, not React state.
    // eslint-disable-next-line react-hooks/immutability
    progress.value = withSpring(zone / (stopCount - 1), SNAP_SPRING);
    runOnJS(onChange)(zone);
  };

  const pan = Gesture.Pan()
    .onBegin(() => {
      pressed.value = withTiming(1, { duration: 100 });
    })
    .onUpdate((event) => {
      const width = trackWidth.value;
      if (width <= 0) return;
      // eslint-disable-next-line react-hooks/immutability -- see snapToNearest above
      progress.value = Math.min(1, Math.max(0, event.x / width));
    })
    // onFinalize (not onEnd) is where the snap belongs — it always runs
    // exactly once, on both a normal release and a cancelled/interrupted
    // gesture (e.g. a parent scroll view stealing the pointer mid-drag).
    // Snapping only in onEnd would leave the thumb stranded off-stop, with
    // no committed value, whenever a drag gets interrupted.
    .onFinalize((event) => {
      pressed.value = withTiming(0, { duration: 150 });
      snapToNearest(progress.value, event.velocityX);
    });

  const thumbStyle = useAnimatedStyle(() => ({
    // Inset by the thumb's own size so it stays flush within [0, trackWidth]
    // at both extremes instead of overflowing past the track by half its
    // width — `progress * trackWidth - THUMB_SIZE/2` (the old formula)
    // centers the thumb ON the endpoints, which pushes half of it outside
    // the track entirely at progress 0 or 1.
    transform: [
      { translateX: progress.value * (trackWidth.value - THUMB_SIZE) },
      { scale: 1 - pressed.value * 0.08 },
    ],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const thumbFillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, MASCOT_STOP_POSITIONS, MASCOT_TO_COLORS),
  }));

  // The current zone as a plain JS number, for VoiceOver/TalkBack — the
  // adjustable role needs a real "now" value and a way to step it, neither
  // of which a drag gesture provides on its own.
  const currentZone = value ?? Math.round(initialProgress * (stopCount - 1));

  const stepTo = (zone: number) => {
    const clamped = Math.min(stopCount - 1, Math.max(0, zone));
    // eslint-disable-next-line react-hooks/immutability -- see snapToNearest above
    progress.value = withSpring(clamped / (stopCount - 1), SNAP_SPRING);
    onChange(clamped);
  };

  const handleAccessibilityAction = (event: { nativeEvent: { actionName: string } }) => {
    if (event.nativeEvent.actionName === 'increment') stepTo(currentZone + 1);
    else if (event.nativeEvent.actionName === 'decrement') stepTo(currentZone - 1);
  };

  return (
    <View style={styles.wrap}>
      <PersonalityMascot progress={progress} ring={false} sparkles={false} />

      {/* Purely visual — the adjustable control below announces the same
          copy via accessibilityValue.text, so a screen reader shouldn't
          also land on these overlapping (mostly invisible) text layers. */}
      <View style={styles.textStack} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {stops.map((stop, index) => (
          <CrossfadeStopText key={stop.label} stop={stop} index={index} count={stopCount} progress={progress} />
        ))}
      </View>

      <GestureDetector gesture={pan}>
        <View
          style={styles.hitArea}
          onLayout={handleLayout}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={accessibilityLabel}
          accessibilityValue={{ min: 0, max: stopCount - 1, now: currentZone, text: stops[currentZone]?.label }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={handleAccessibilityAction}>
          <View style={styles.track}>
            <Animated.View style={[styles.fill, fillStyle]} />
            <View style={styles.stopMarks}>
              {stops.map((stop, index) => (
                <View
                  key={stop.label}
                  style={[
                    styles.stopMark,
                    { backgroundColor: MASCOT_TO_COLORS[index % MASCOT_TO_COLORS.length] },
                  ]}
                />
              ))}
            </View>
          </View>
          {trackWidthState > 0 && (
            <Animated.View pointerEvents="none" style={[styles.thumbRing, thumbStyle]}>
              <Animated.View style={[styles.thumb, thumbFillStyle]} />
            </Animated.View>
          )}
        </View>
      </GestureDetector>
    </View>
  );
}

function CrossfadeStopText({
  stop,
  index,
  count,
  progress,
}: {
  stop: ScaleStop;
  index: number;
  count: number;
  progress: SharedValue<number>;
}) {
  const { input, output } = boundaryOpacityRange(index, count, BOUNDARY_BLEND);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, input, output, Extrapolation.CLAMP),
  }));

  return (
    <Animated.View style={[styles.textLayer, style]} pointerEvents="none">
      <Text style={styles.tierLabel}>{stop.label}</Text>
      <Text style={styles.tierDescription}>{stop.description}</Text>
    </Animated.View>
  );
}

/** Full opacity within a stop's zone; crossfades only in a narrow band around each boundary it shares with a neighbor. */
function boundaryOpacityRange(index: number, count: number, blend: number) {
  const boundaries = Array.from({ length: count - 1 }, (_, k) => (k + 1) / count);
  const input: number[] = [];
  const output: number[] = [];

  if (index > 0) {
    const b = boundaries[index - 1];
    input.push(b - blend, b + blend);
    output.push(0, 1);
  }
  if (index < count - 1) {
    const b = boundaries[index];
    input.push(b - blend, b + blend);
    output.push(1, 0);
  }
  if (input.length === 0) {
    // Single-stop edge case — always visible.
    input.push(0, 1);
    output.push(1, 1);
  }
  return { input, output };
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 20,
    width: '100%',
    // Narrows the track itself (hitArea/track both key off this column's
    // width, not the raw screen width) so it reads as a control sitting on
    // the screen rather than a bar spanning edge to edge.
    paddingHorizontal: 26,
  },
  textStack: {
    // Generous on purpose — these layers are absolutely positioned, so a
    // longer description (a future stop's copy, a longer localization, or
    // larger accessibility text sizing) needs headroom already reserved,
    // not a height that only happens to fit today's three descriptions.
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  textLayer: {
    position: 'absolute',
    alignItems: 'center',
    gap: 4,
    width: '100%',
  },
  tierLabel: {
    color: Palette.text,
    fontSize: 21,
    fontWeight: '700',
    fontFamily: FontFamily.display.bold,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  tierDescription: {
    color: Palette.muted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FontFamily.body.regular,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  hitArea: {
    // No horizontal padding — trackWidth (measured off this view) has to be
    // the exact same box the thumb's translateX and the stop dots both key
    // off of. Any padding/border between here and the dots shifts them out
    // of sync with the thumb, which is what let the dot peek out from
    // behind it at the endpoints.
    width: '100%',
    height: THUMB_SIZE + 16,
    justifyContent: 'center',
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    // Was Palette.canvas (black) — identical to the screen behind it, so
    // the track was only ever visible because of the border. It needs its
    // own real fill instead, now that the border's gone (see hitArea note).
    // Lighter, low-opacity grey instead of the solid slate ring color —
    // reads as a faint groove rather than a heavy dark bar.
    backgroundColor: 'rgba(200, 202, 208, 0.28)',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Palette.paper,
    opacity: 0.35,
  },
  stopMarks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Matches the thumb's new inset travel range (translateX now maxes out
    // at trackWidth - THUMB_SIZE) so each dot sits exactly where the
    // thumb's center comes to rest, not past it.
    paddingHorizontal: THUMB_SIZE / 2,
  },
  stopMark: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Palette.ring,
  },
  thumbRing: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 3,
    borderColor: Palette.ring,
    backgroundColor: Palette.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB_SIZE - 10,
    height: THUMB_SIZE - 10,
    borderRadius: (THUMB_SIZE - 10) / 2,
    // No static backgroundColor here — thumbFillStyle drives it continuously.
  },
});
