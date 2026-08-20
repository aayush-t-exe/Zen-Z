import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { AuthButton } from '@/components/auth-button';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { formatSlotDateTime, formatDuration } from '@/lib/format';

interface Slot {
  id: string;
  slot_datetime: string;
  activity_type_id: number;
}

interface Activity {
  id: number;
  name: string;
  emoji: string;
  min_group_size: number;
  max_group_size: number;
  duration_minutes: number | null;
  convenience_fee: number;
}

const BUDGET_BANDS = [
  { value: 'under_200', label: 'Under ₹200' },
  { value: '200_400', label: '₹200–400' },
  { value: '400_plus', label: '₹400+' },
];

// Activities with a fixed duration (currently just the Sports games) have a
// fixed, already-known price — asking for a budget range doesn't make sense
// when there's nothing to range over, so that step is skipped for them.
// Sports groups are also auto-mixed rather than gender-filtered, so the
// group-preference step is skipped too — group_preference is stored as
// 'mixed' for these bookings without asking.
type BookingStep = 'time' | 'budget' | 'preference' | 'summary';
const STEPS_WITH_BUDGET: BookingStep[] = ['time', 'budget', 'preference', 'summary'];
const STEPS_FIXED_PRICE: BookingStep[] = ['time', 'summary'];

const GROUP_PREFERENCES = [
  { value: 'mixed', label: 'Surprise me (mixed)' },
  { value: 'women_only', label: 'Women only' },
  { value: 'men_only', label: 'Men only' },
];

// This map only feeds the summary card's activity row, which sits on a
// cream background — the opposite of Home's black activity cards. Dinners
// and Movies use the dark-outlined variant here since their cream-filled
// Home icon otherwise disappears against the cream card.
const ACTIVITY_ICONS: Record<string, any> = {
  Cafés: require('@/assets/images/icon-cafes.png'),
  Dinners: require('@/assets/images/icon-dinners-dark.png'),
  Movies: require('@/assets/images/icon-movies-dark.png'),
  Sports: require('@/assets/images/icon-sports.png'),
  // Sports bookings carry the specific game's name (not "Sports"), and its
  // fixed-price flow skips straight from "time" to "summary" — this map
  // needs an entry for each game or the summary row's icon comes up empty.
  'Box Cricket': require('@/assets/images/icon-cricket.png'),
  Football: require('@/assets/images/icon-football.png'),
  '8-Ball Pool': require('@/assets/images/icon-pool.png'),
  Pickleball: require('@/assets/images/icon-pickleball.png'),
};

// Games like 8-Ball Pool and Pickleball have a fixed group size (min ===
// max) — "Group of 4–4" reads as a typo, so collapse it to a single number.
const formatGroupSize = (min: number, max: number) => (min === max ? `${min}` : `${min}–${max}`);

const PILL_RATIO = 420 / 2059;
const CARD_SMALL_RATIO = 188 / 978;
const CARD_LARGE_RATIO = 2500 / 1912;
const TIME_ART_RATIO = 1086 / 1173;

function OptionPill({
  label,
  selected,
  onPress,
  width,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  width: number;
}) {
  const height = width * PILL_RATIO;
  return (
    <Pressable onPress={onPress} style={{ width, height }}>
      <Image
        source={require('@/assets/images/bubble-pill.png')}
        style={{ width, height }}
        resizeMode="stretch"
      />
      <View style={[StyleSheet.absoluteFill, styles.pillContent]}>
        <Image
          source={require('@/assets/images/star-dark.png')}
          style={styles.pillStar}
          resizeMode="contain"
        />
        <Text style={styles.pillLabel}>{label}</Text>
        {selected && <Text style={styles.pillCheck}>✓</Text>}
      </View>
    </Pressable>
  );
}

function OptionCard({
  label,
  selected,
  onPress,
  width,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  width: number;
}) {
  const height = width * CARD_SMALL_RATIO;
  return (
    <Pressable onPress={onPress} style={{ width, height }}>
      <Image
        source={require('@/assets/images/bubble-card-small.png')}
        style={{ width, height }}
        resizeMode="stretch"
      />
      <View style={[StyleSheet.absoluteFill, styles.cardContent]}>
        <Text style={styles.cardLabel}>{label}</Text>
        {selected && <Text style={styles.pillCheck}>✓</Text>}
      </View>
    </Pressable>
  );
}

export default function BookingFlowScreen() {
  const router = useRouter();
  const { activityId } = useLocalSearchParams<{ activityId: string }>();
  const user = useAuthStore((state) => state.user);
  const { width: screenWidth } = useWindowDimensions();
  const contentWidth = Math.min(358, screenWidth - 30);

  const [stepIndex, setStepIndex] = useState(0);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<string | null>(null);
  const [selectedPreference, setSelectedPreference] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [blockedUntil, setBlockedUntil] = useState<string | null>(null);
  const [profileGender, setProfileGender] = useState<string | null>(null);

  const activityNumId = parseInt(activityId || '0');
  const steps = activity?.duration_minutes ? STEPS_FIXED_PRICE : STEPS_WITH_BUDGET;
  const currentStep = steps[stepIndex];

  // Expo Router can reuse this screen's instance when navigating here again
  // with a different activityId (e.g. going back to Sports and picking a
  // different game) instead of remounting it — without this, a leftover
  // selectedSlot from the previous activity stays "selected" (silently
  // enabling Next) even though it no longer matches anything in the newly
  // loaded slots list, leaving the summary's "When" field blank. Resetting
  // during render (React's documented pattern for "adjust state when a
  // prop changes") rather than in an effect, so it happens before paint.
  const [prevActivityNumId, setPrevActivityNumId] = useState(activityNumId);
  if (activityNumId !== prevActivityNumId) {
    setPrevActivityNumId(activityNumId);
    setStepIndex(0);
    setSelectedSlot(null);
    setSelectedBudget(null);
    setSelectedPreference(null);
    setError('');
  }

  const loadActivityAndSlots = useCallback(async () => {
    try {
      setIsLoading(true);
      setBlockedUntil(null);

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('booking_blocked_until, gender')
          .eq('id', user.id)
          .single();

        setProfileGender(profile?.gender ?? null);

        if (profile?.booking_blocked_until && new Date(profile.booking_blocked_until) > new Date()) {
          setBlockedUntil(profile.booking_blocked_until);
          setIsLoading(false);
          return;
        }
      }

      // Fetch activity
      const { data: actData } = await supabase
        .from('activity_types')
        .select('*')
        .eq('id', activityNumId)
        .single();

      if (actData) setActivity(actData);

      // Fetch available slots for this activity (next 30 days)
      const { data: slotData } = await supabase
        .from('slots')
        .select('*')
        .eq('activity_type_id', activityNumId)
        .eq('status', 'open')
        .gt('slot_datetime', new Date().toISOString())
        .lt('slot_datetime', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('slot_datetime', { ascending: true });

      if (slotData) setSlots(slotData);
    } catch (err) {
      console.error('Error loading activity:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, activityNumId]);

  useFocusEffect(
    useCallback(() => {
      loadActivityAndSlots();
    }, [loadActivityAndSlots])
  );

  const handleCreateBooking = async () => {
    const budgetRequired = steps.includes('budget');
    const preferenceRequired = steps.includes('preference');
    if (
      !selectedSlot ||
      (budgetRequired && !selectedBudget) ||
      (preferenceRequired && !selectedPreference) ||
      !user
    ) {
      setError('Please select all options');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { error: bookingError } = await supabase.from('bookings').insert({
        user_id: user.id,
        slot_id: selectedSlot,
        budget_band: budgetRequired ? selectedBudget : null,
        group_preference: preferenceRequired ? selectedPreference : 'mixed',
        status: 'pending_match',
      });

      if (bookingError) {
        // A blocked student can slip past the pre-check above if the block
        // was applied in the moment between screen load and submit — the
        // RLS policy (0020_no_show_strikes.sql) still catches it, just with
        // an opaque Postgres message that isn't fit to show directly.
        setError(
          bookingError.message.includes('row-level security policy')
            ? "Your invitations are paused right now — check back later."
            : bookingError.message
        );
        return;
      }

      // Navigate to payment (Milestone 12)
      router.push({
        pathname: '/payment' as any,
        params: { slotId: selectedSlot },
      });
    } catch (err: any) {
      setError(err.message || 'Failed to create booking');
    } finally {
      setIsLoading(false);
    }
  };

  const canProceedToNextStep = () => {
    if (currentStep === 'time') return slots.some((s) => s.id === selectedSlot);
    if (currentStep === 'budget') return !!selectedBudget;
    if (currentStep === 'preference') return !!selectedPreference;
    return true;
  };

  const handleNext = () => {
    setError('');
    if (stepIndex < steps.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      handleCreateBooking();
    }
  };

  const handleBack = () => {
    setError('');
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    } else {
      router.back();
    }
  };

  if (isLoading && !activity && !blockedUntil) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={Palette.text} />
      </View>
    );
  }

  if (blockedUntil) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }]}>
        <Text style={{ fontSize: 32, marginBottom: 8 }}>🕯️</Text>
        <Text style={[styles.title, { textAlign: 'center', fontSize: 22 }]}>Your invitations are paused.</Text>
        <Text style={[styles.subtitle, { textAlign: 'center', marginTop: 8 }]}>
          Three empty seats in a row does that. Check back {formatSlotDateTime(blockedUntil)}.
        </Text>
      </View>
    );
  }

  const selectedActivityIcon = activity ? ACTIVITY_ICONS[activity.name] : null;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Step counter + activity context */}
        <View style={{ width: contentWidth, marginBottom: 20, gap: 2 }}>
          <Text style={styles.stepCounter}>
            Step {stepIndex + 1} of {steps.length}
          </Text>
          {activity && (
            <Text style={styles.activityLabel}>
              {activity.emoji} {activity.name}
            </Text>
          )}
        </View>

        {/* Day & Time Selection */}
        {currentStep === 'time' && (
          <View style={{ width: contentWidth, gap: 18 }}>
            <View style={{ gap: 6 }}>
              <Text style={styles.title}>When do you want your story to begin?</Text>
              <Text style={styles.subtitle}>Pick a fixed weekly slot</Text>
            </View>

            {slots.length > 0 ? (
              <View style={{ gap: 12 }}>
                {slots.map((slot) => (
                  <OptionPill
                    key={slot.id}
                    label={formatSlotDateTime(slot.slot_datetime)}
                    selected={selectedSlot === slot.id}
                    onPress={() => setSelectedSlot(selectedSlot === slot.id ? null : slot.id)}
                    width={contentWidth}
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.subtitle}>No available slots at the moment.</Text>
            )}

            <Image
              source={require('@/assets/images/booking-time-art.png')}
              style={{
                width: contentWidth * 0.85,
                height: contentWidth * 0.85 * TIME_ART_RATIO,
                alignSelf: 'center',
                marginTop: 64,
              }}
              resizeMode="contain"
            />
          </View>
        )}

        {/* Budget Selection */}
        {currentStep === 'budget' && (
          <View style={{ width: contentWidth, gap: 18 }}>
            <View style={{ gap: 6 }}>
              <Text style={styles.title}>What&apos;s your range?</Text>
              <Text style={styles.subtitle}>This helps us match similar budgets</Text>
            </View>

            <View style={{ gap: 14 }}>
              {BUDGET_BANDS.map((band) => (
                <OptionCard
                  key={band.value}
                  label={band.label}
                  selected={selectedBudget === band.value}
                  onPress={() => setSelectedBudget(band.value)}
                  width={contentWidth}
                />
              ))}
            </View>
          </View>
        )}

        {/* Group Preference Selection */}
        {currentStep === 'preference' && (
          <View style={{ width: contentWidth, gap: 18 }}>
            <View style={{ gap: 6 }}>
              <Text style={styles.title}>Who&apos;s in the room?</Text>
              <Text style={styles.subtitle}>Choose your group dynamic</Text>
            </View>

            <View style={{ gap: 14 }}>
              {GROUP_PREFERENCES.map((pref) => (
                <OptionCard
                  key={pref.value}
                  label={pref.label}
                  selected={selectedPreference === pref.value}
                  onPress={() => {
                    // A men_only/women_only preference only makes sense
                    // for that gender — matches the hard gate
                    // MatchingBoard.tsx (requiredGenderForGroup/
                    // placementViolation) already enforces when a founder
                    // places a group. Options stay visible either way —
                    // students should see they exist, not have them
                    // silently disappear — but picking an incompatible
                    // one explains why it's blocked instead of selecting it.
                    if (pref.value === 'women_only' && profileGender === 'male') {
                      setError("Women only is for students who are women — it's not available for your profile.");
                      return;
                    }
                    if (pref.value === 'men_only' && profileGender === 'female') {
                      setError("Men only is for students who are men — it's not available for your profile.");
                      return;
                    }
                    setError('');
                    setSelectedPreference(pref.value);
                  }}
                  width={contentWidth}
                />
              ))}
            </View>
          </View>
        )}

        {/* Confirmation */}
        {currentStep === 'summary' &&
          activity &&
          selectedSlot &&
          (steps.includes('budget') ? selectedBudget : true) &&
          (steps.includes('preference') ? selectedPreference : true) && (
          <View style={{ width: contentWidth, gap: 18 }}>
            <Text style={styles.title}>Your adventure awaits</Text>
            <Text style={styles.subtitle}>Confirm your choices</Text>

            <View style={{ width: contentWidth, height: contentWidth * CARD_LARGE_RATIO }}>
              <Image
                source={require('@/assets/images/bubble-card-large.png')}
                style={{ width: contentWidth, height: contentWidth * CARD_LARGE_RATIO }}
                resizeMode="stretch"
              />
              <View style={[StyleSheet.absoluteFill, styles.summaryContent]}>
                <SummaryRow icon={selectedActivityIcon} label={activity.name} />
                <SummaryRow
                  iconSource={require('@/assets/images/star-dark.png')}
                  label={
                    slots.find((s) => s.id === selectedSlot)
                      ? formatSlotDateTime(slots.find((s) => s.id === selectedSlot)!.slot_datetime)
                      : ''
                  }
                />
                <SummaryRow
                  iconSource={require('@/assets/images/icon-group.png')}
                  label={
                    `Group of ${formatGroupSize(activity.min_group_size, activity.max_group_size)}` +
                    (steps.includes('preference')
                      ? ` · ${GROUP_PREFERENCES.find((p) => p.value === selectedPreference)?.label}`
                      : '')
                  }
                />
                {steps.includes('budget') && (
                  <SummaryRow
                    iconSource={require('@/assets/images/icon-budget.png')}
                    label={BUDGET_BANDS.find((b) => b.value === selectedBudget)?.label ?? ''}
                  />
                )}

                {/* Duration & price (fixed-price activities, e.g. Sports) */}
                {activity.duration_minutes != null && (
                  <View style={styles.priceBox}>
                    <Text style={styles.priceValue}>₹{activity.convenience_fee}</Text>
                    <Text style={styles.priceCaption}>
                      for {formatDuration(activity.duration_minutes)}? Steal.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      {/* Navigation buttons */}
      <View style={{ width: contentWidth, alignSelf: 'center', paddingBottom: 32, paddingTop: 12, gap: 14 }}>
        <Pressable onPress={handleBack} hitSlop={8}>
          <Text style={styles.backLabel}>← Back</Text>
        </Pressable>

        <AuthButton
          label={currentStep === 'summary' ? 'Unlock Your Next Adventure' : 'Next  →'}
          onPress={handleNext}
          loading={isLoading}
          disabled={!canProceedToNextStep()}
          style={{ width: contentWidth }}
        />
      </View>
    </View>
  );
}

function SummaryRow({
  icon,
  iconSource,
  label,
}: {
  icon?: any;
  iconSource?: any;
  label: string;
}) {
  return (
    <View>
      <View style={styles.summaryRow}>
        <Image source={icon ?? iconSource} style={styles.summaryIcon} resizeMode="contain" />
        <Text style={styles.summaryLabel}>{label}</Text>
      </View>
      <View style={styles.summaryDivider} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Palette.canvas,
  },
  scroll: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 16,
  },
  stepCounter: {
    color: Palette.muted,
    fontSize: 13,
  },
  activityLabel: {
    color: Palette.text,
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    color: Palette.text,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: Palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  pillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    gap: 10,
  },
  pillStar: {
    width: 16,
    height: 16,
  },
  pillLabel: {
    color: Palette.line,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  pillCheck: {
    color: Palette.line,
    fontSize: 18,
    fontWeight: '700',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    gap: 10,
  },
  cardLabel: {
    color: Palette.line,
    fontSize: 17,
    fontWeight: '700',
  },
  summaryContent: {
    padding: '10%',
    justifyContent: 'space-evenly',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Palette.ring,
    opacity: 0.4,
    marginTop: 10,
  },
  summaryIcon: {
    width: 32,
    height: 32,
  },
  summaryLabel: {
    color: Palette.line,
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  priceBox: {
    alignItems: 'center',
    gap: 2,
  },
  priceValue: {
    color: Palette.line,
    fontSize: 34,
    fontWeight: '800',
  },
  priceCaption: {
    color: Palette.line,
    fontSize: 13,
    fontWeight: '600',
  },
  error: {
    color: Palette.error,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 8,
  },
  backLabel: {
    color: Palette.text,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
