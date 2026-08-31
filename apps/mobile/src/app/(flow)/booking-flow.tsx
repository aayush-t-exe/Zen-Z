import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FontFamily } from '@/constants/fonts';
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

// Must match the "own bookings insert" RLS policy's cutoff rule: a slot
// stops being bookable at midnight IST, 2 days before its date — the same
// calendar rule for every activity, chosen over a flat hour count so it's
// something a student can actually reason about ("book by end of day, 2
// days ahead"). India has no DST, so a fixed +5:30 offset is safe here.
// See supabase/migrations/0044_midnight_ist_booking_cutoff.sql.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getBookingCutoffInstant(): Date {
  const nowIst = new Date(Date.now() + IST_OFFSET_MS);
  const todayIstMidnightMs = Date.UTC(
    nowIst.getUTCFullYear(),
    nowIst.getUTCMonth(),
    nowIst.getUTCDate()
  );
  return new Date(todayIstMidnightMs + 3 * 24 * 60 * 60 * 1000 - IST_OFFSET_MS);
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
// Movies also charges a fixed price (hardcoded convenience_fee, see
// migration 0040) but still gender-filters groups like Cafés/Dinners, so it
// skips only the budget step, not preference.
type BookingStep = 'time' | 'budget' | 'preference' | 'summary';
const STEPS_WITH_BUDGET: BookingStep[] = ['time', 'budget', 'preference', 'summary'];
const STEPS_FIXED_PRICE: BookingStep[] = ['time', 'summary'];
const STEPS_FIXED_PRICE_WITH_PREFERENCE: BookingStep[] = ['time', 'preference', 'summary'];

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
  const [plusOne, setPlusOne] = useState(false);
  const [friendName, setFriendName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [blockedUntil, setBlockedUntil] = useState<string | null>(null);
  const [profileGender, setProfileGender] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const activityNumId = parseInt(activityId || '0');
  const steps = activity?.duration_minutes
    ? STEPS_FIXED_PRICE
    : activity?.name === 'Movies'
    ? STEPS_FIXED_PRICE_WITH_PREFERENCE
    : STEPS_WITH_BUDGET;
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
    setPlusOne(false);
    setFriendName('');
    setError('');
  }

  const loadActivityAndSlots = useCallback(async () => {
    try {
      setIsLoading(true);
      setBlockedUntil(null);
      setLoadError(null);

      if (user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('booking_blocked_until, gender')
          .eq('id', user.id)
          .single();

        if (profileError) {
          setLoadError(profileError.message);
          return;
        }

        setProfileGender(profile?.gender ?? null);

        if (profile?.booking_blocked_until && new Date(profile.booking_blocked_until) > new Date()) {
          setBlockedUntil(profile.booking_blocked_until);
          return;
        }
      }

      // Fetch activity
      const { data: actData, error: actError } = await supabase
        .from('activity_types')
        .select('*')
        .eq('id', activityNumId)
        .single();

      if (actError) {
        setLoadError(actError.message);
        return;
      }

      if (actData) setActivity(actData);

      // Only the single nearest open slot — offering weeks of Tuesdays to
      // choose from read like a duplicate ("2 slots for Movies") when really
      // it was next week's slot opening early. One fixed weekly slot at a
      // time matches the actual product model.
      //
      // The lower bound mirrors the midnight-IST cutoff enforced by the "own
      // bookings insert" RLS policy — a slot inside that window would fail
      // on submit anyway, so it's excluded here rather than shown and then
      // rejected.
      const { data: slotData, error: slotError } = await supabase
        .from('slots')
        .select('*')
        .eq('activity_type_id', activityNumId)
        .eq('status', 'open')
        .gte('slot_datetime', getBookingCutoffInstant().toISOString())
        .lt('slot_datetime', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('slot_datetime', { ascending: true })
        .limit(1);

      if (slotError) {
        setLoadError(slotError.message);
        return;
      }

      // A student re-opening this activity after starting (but not
      // finishing) a booking for its slot would otherwise click through
      // every step only to hit bookings_user_slot_active_unique's raw
      // duplicate error at the very end. They already have exactly one
      // thing left to do for this slot — finish paying — so skip straight
      // there instead of making them rediscover that via a dead-end error.
      if (slotData && slotData.length > 0 && user) {
        const { data: existingBooking } = await supabase
          .from('bookings')
          .select('id')
          .eq('user_id', user.id)
          .eq('slot_id', slotData[0].id)
          .eq('status', 'pending_match')
          .maybeSingle();

        if (existingBooking) {
          router.replace({
            pathname: '/payment' as any,
            params: { slotId: slotData[0].id },
          });
          return;
        }
      }

      if (slotData) setSlots(slotData);
    } catch (err: any) {
      console.error('Error loading activity:', err);
      setLoadError(err.message || 'Something went wrong. Please try again.');
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

    if (plusOne && !friendName.trim()) {
      setError("Who are you bringing? Add their name, or turn off Bring a +1.");
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
        plus_one: plusOne,
        plus_one_name: plusOne ? friendName.trim() : null,
      });

      if (bookingError) {
        // The "own bookings insert" RLS policy (0020_no_show_strikes.sql,
        // extended by 0044_midnight_ist_booking_cutoff.sql) now guards two
        // unrelated things at once — a no-show block applied mid-session, or
        // the slot crossing the midnight-IST cutoff while this screen sat
        // open — and Postgres gives back the same opaque message for both.
        // Naming either reason specifically would be wrong half the time, so
        // this stays neutral rather than wrongly implying a no-show penalty.
        //
        // '23505' is Postgres's unique-violation code — bookings_user_slot_
        // active_unique (0054) rejects a second active booking for the same
        // slot, most likely from a double-tap on this same button.
        setError(
          bookingError.code === '23505'
            ? "You've already got a booking for this slot — check Your Events."
            : bookingError.message.includes('row-level security policy')
              ? "That invitation just slipped out of reach — go back and check again."
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

  if (isLoading && !activity && !blockedUntil && !loadError) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={Palette.text} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }]}>
        <Text style={[styles.title, { textAlign: 'center', fontSize: 22 }]}>Couldn&apos;t load this.</Text>
        <Text style={[styles.subtitle, { textAlign: 'center', marginTop: 8 }]}>{loadError}</Text>
        <View style={{ marginTop: 24, width: contentWidth }}>
          <AuthButton label="Retry" onPress={loadActivityAndSlots} loading={isLoading} />
        </View>
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
                    label={formatSlotDateTime(slot.slot_datetime, activity?.name)}
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
                    // for that exact gender — matches the hard gate
                    // MatchingBoard.tsx's requiredGenderForGroup/
                    // placementViolation and confirm_group() (0023/0058)
                    // both enforce: every member's gender must literally
                    // equal 'female' (women_only) or 'male' (men_only).
                    // This used to only block the *opposite* binary gender
                    // (male from women_only, female from men_only), which
                    // let 'other'/'prefer_not_to_say' students select a
                    // preference that could then never actually be
                    // honored — no group containing them could ever pass
                    // the matching gate, with nothing explaining why.
                    // Checking for the exact required gender instead of
                    // excluding the opposite one closes that gap. Options
                    // stay visible either way — students should see they
                    // exist, not have them silently disappear — but
                    // picking one that isn't available now explains why
                    // it's blocked instead of selecting it.
                    if (pref.value === 'women_only' && profileGender !== 'female') {
                      setError("Women only is for students who are women — it's not available for your profile.");
                      return;
                    }
                    if (pref.value === 'men_only' && profileGender !== 'male') {
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
                      ? formatSlotDateTime(slots.find((s) => s.id === selectedSlot)!.slot_datetime, activity?.name)
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
                    <Text style={styles.priceValue}>
                      ₹{plusOne ? activity.convenience_fee * 2 : activity.convenience_fee}
                    </Text>
                    <Text style={styles.priceCaption}>
                      for {formatDuration(activity.duration_minutes)}
                      {plusOne ? ', plus your +1' : ''}? Steal.
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <OptionCard
              label="Bring a +1"
              selected={plusOne}
              onPress={() => {
                setPlusOne(!plusOne);
                if (plusOne) setFriendName('');
              }}
              width={contentWidth}
            />
            {plusOne && (
              <TextInput
                value={friendName}
                onChangeText={(text) => {
                  setFriendName(text);
                  setError('');
                }}
                placeholder="Their name"
                placeholderTextColor={Palette.muted}
                style={styles.friendInput}
              />
            )}
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
  title: {
    color: Palette.text,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    fontFamily: FontFamily.display.bold,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: Palette.muted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FontFamily.body.regular,
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
    fontFamily: FontFamily.body.semiBold,
    flex: 1,
  },
  pillCheck: {
    color: Palette.line,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FontFamily.body.bold,
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
    fontFamily: FontFamily.body.bold,
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
    fontFamily: FontFamily.body.bold,
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
    fontFamily: FontFamily.body.bold,
  },
  priceCaption: {
    color: Palette.line,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FontFamily.body.semiBold,
  },
  friendInput: {
    borderWidth: 2,
    borderColor: Palette.ring,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    color: Palette.text,
    fontSize: 16,
    fontFamily: FontFamily.body.regular,
  },
  error: {
    color: Palette.error,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FontFamily.body.semiBold,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 8,
  },
  backLabel: {
    color: Palette.text,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily.body.semiBold,
    textAlign: 'center',
  },
});
