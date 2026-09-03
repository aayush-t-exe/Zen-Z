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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FontFamily } from '@/constants/fonts';
import {
  FLOW_CHECK_ASPECT,
  FLOW_CHECK_RIGHT,
  FLOW_CHECK_W,
  FLOW_CONTENT_MAX,
  FLOW_ROW_SCALE,
  FLOW_SIDE_PADDING,
  FlowText,
} from '@/constants/flow-theme';
import { FlowField, FlowPanel } from '@/components/flow-panel';
import { FlowPillButton } from '@/components/flow-pill-button';
import { FlowBackButton } from '@/components/flow-back-button';
import {
  SUMMARY_ICONS,
  SummaryCard,
  SummaryToggleRow,
  type SummaryIcon,
} from '@/components/summary-card';
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

// Labels are the comp's own (UI PAGE 3): the second band repeats the rupee
// sign rather than eliding it, and the third spaces the plus off the figure.
// `value` is what lands in `bookings.budget_band` — those stay untouched.
const BUDGET_BANDS = [
  { value: 'under_200', label: 'Under ₹200' },
  { value: '200_400', label: '₹200 - ₹400' },
  { value: '400_plus', label: '₹400 +' },
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

/**
 * Feeds the summary card's activity row, which now sits in a dark badge
 * rather than on the old cream bubble — so these are the light-on-black
 * variants, not the dark-outlined ones.
 *
 * [ASSUMPTION] The UI PAGE 5 comp only shipped a line-art glyph for Dinners
 * (icon-dinners-line.png), which is the one used at the comp's own scale
 * below. Every other activity falls back to its existing illustration at a
 * smaller scale so it still sits inside the badge — those read as a different
 * icon language than the crisp white marks on the other three rows, and want
 * replacing with matching line art when the founder draws it. Sports
 * bookings carry the specific game's name (not "Sports"), so this map needs
 * an entry per game or the row's icon comes up empty.
 */
const ACTIVITY_ICONS: Record<string, SummaryIcon> = {
  Dinners: SUMMARY_ICONS.dinners,
  Cafés: { source: require('@/assets/images/icon-cafes.png'), scale: 0.62 },
  Movies: { source: require('@/assets/images/icon-movies.png'), scale: 0.62 },
  Sports: { source: require('@/assets/images/icon-sports.png'), scale: 0.62 },
  'Box Cricket': { source: require('@/assets/images/icon-cricket.png'), scale: 0.62 },
  Football: { source: require('@/assets/images/icon-football.png'), scale: 0.62 },
  '8-Ball Pool': { source: require('@/assets/images/icon-pool.png'), scale: 0.62 },
  Pickleball: { source: require('@/assets/images/icon-pickleball.png'), scale: 0.62 },
};

// Games like 8-Ball Pool and Pickleball have a fixed group size (min ===
// max) — "Group of 4–4" reads as a typo, so collapse it to a single number.
const formatGroupSize = (min: number, max: number) => (min === max ? `${min}` : `${min}–${max}`);


/**
 * Geometry for the redesigned "time" step, measured off the approved comp
 * (Desktop/UI/UI PAGE 2). That file is 1170x2532 — a 390pt screen at @3x — so
 * comp pixels divide by 3 for dp. This screen runs wider side margins (45dp)
 * than Home's 21dp, giving a 300dp content column.
 */
const SLOT_ROW_RATIO = 154 / 902; // row height / width
// The row art keeps 100px of its outer glow on each side so the lit halo the
// comp shows around the box survives. That glow is very diffuse — it never
// reaches zero inside the source canvas — so the export also ramps its alpha
// out over the outer edge; cropping it plain left a visible rectangle. The box
// is only the middle of that image, so the art draws oversized and offset to
// land the box exactly on the row's bounds, glow spilling outside.
const SLOT_GLOW_W = 1102 / 902;
const SLOT_GLOW_H = 354 / 154;
const SLOT_GLOW_OFFSET_X = 100 / 902;
const SLOT_GLOW_OFFSET_Y = 100 / 154;
const CHARACTERS_RATIO = 868 / 877; // illustration height / width
// Positions inside the slot row, as fractions of its width.
const SLOT_STAR_W = 19.7 / 300.3;
const SLOT_STAR_LEFT = 13.6 / 300.3;
const SLOT_STAR_GAP = 17.6 / 300.3;

/**
 * Geometry for the redesigned "budget" and "preference" steps, measured off
 * their approved comps (Desktop/UI/UI PAGE 3 and 4) on the same basis as the
 * "time" step above: 1170x2532 is a 390pt screen at @3x, so comp pixels
 * divide by 3. Both comps ship the same panel art and place all three panels
 * at the same y, so the two steps share every number here.
 *
 * The panel itself is now FlowPanel (components/flow-panel.tsx) — the same
 * row profile creation, the quiz and the profile tab draw from — so its
 * ratio, scale and tick geometry live in constants/flow-theme.ts. Only the
 * illustration below is specific to this step.
 */
const BUDGET_NOTES_RATIO = 604 / 902; // illustration canvas height / width
// The illustration keeps the designer's full canvas, transparent margins
// included, so the art lands where the comp places it without carrying a pair
// of crop offsets. Drawn slightly under the content column: the comp's own
// vertical rhythm can't fit beside the founder's larger type, taller rows and
// lifted footer, so the notes give back ~22dp for the gaps to use.
const BUDGET_NOTES_SCALE = 0.93;

function SlotRow({
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
  const height = width * SLOT_ROW_RATIO * FLOW_ROW_SCALE;
  const starSize = width * SLOT_STAR_W;
  const checkSize = width * FLOW_CHECK_W;
  return (
    <Pressable onPress={onPress} style={{ width, height }}>
      <Image
        source={require('@/assets/images/booking-slot-row.png')}
        style={{
          position: 'absolute',
          left: -width * SLOT_GLOW_OFFSET_X,
          top: -height * SLOT_GLOW_OFFSET_Y,
          width: width * SLOT_GLOW_W,
          height: height * SLOT_GLOW_H,
        }}
        resizeMode="stretch"
        accessibilityIgnoresInvertColors
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            flexDirection: 'row',
            alignItems: 'center',
            paddingLeft: width * SLOT_STAR_LEFT,
            paddingRight: width * FLOW_CHECK_RIGHT,
          },
        ]}>
        <Image
          source={require('@/assets/images/icon-star-outline.png')}
          style={{ width: starSize, height: starSize * (171 / 180) }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        <Text style={[styles.slotLabel, { marginLeft: width * SLOT_STAR_GAP }]} numberOfLines={1}>
          {label}
        </Text>
        {selected && (
          <Image
            source={require('@/assets/images/icon-check-filled.png')}
            style={{ width: checkSize, height: checkSize * FLOW_CHECK_ASPECT }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        )}
      </View>
    </Pressable>
  );
}

export default function BookingFlowScreen() {
  const router = useRouter();
  const { activityId } = useLocalSearchParams<{ activityId: string }>();
  const user = useAuthStore((state) => state.user);
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const contentWidth = Math.min(FLOW_CONTENT_MAX, screenWidth - FLOW_SIDE_PADDING * 2);

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
          <FlowPillButton label="Retry" width={contentWidth} onPress={loadActivityAndSlots} loading={isLoading} />
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

  const activityIcon = (activity && ACTIVITY_ICONS[activity.name]) || SUMMARY_ICONS.slot;
  const selectedSlotRow = slots.find((slot) => slot.id === selectedSlot) ?? null;
  const totalFee = activity ? (plusOne ? activity.convenience_fee * 2 : activity.convenience_fee) : 0;

  /**
   * Jumps back to an earlier step from the summary card's chevrons. Every
   * selection lives in this screen's state, so stepping back and forward
   * again leaves the booking exactly as it was.
   */
  const goToStep = (step: BookingStep) => {
    const index = steps.indexOf(step);
    if (index === -1) return;
    setError('');
    setStepIndex(index);
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Day & Time Selection */}
        {currentStep === 'time' && (
          <View style={{ width: contentWidth }}>
            {/* Break is explicit, not left to wrapping — the comp sets this
                heading as "When do you want your / story to begin" and natural
                wrapping would shift with device width or a font-scale setting. */}
            <Text style={styles.flowTitle}>When do you want your{'\n'}story to begin?</Text>
            <Text style={styles.flowSubtitle}>Pick a fixed weekly slot.</Text>

            {slots.length > 0 ? (
              <View style={{ gap: 12, marginTop: 30 }}>
                {slots.map((slot) => (
                  <SlotRow
                    key={slot.id}
                    label={formatSlotDateTime(slot.slot_datetime, activity?.name)}
                    selected={selectedSlot === slot.id}
                    onPress={() => setSelectedSlot(selectedSlot === slot.id ? null : slot.id)}
                    width={contentWidth}
                  />
                ))}
              </View>
            ) : (
              <Text style={[styles.flowSubtitle, { marginTop: 30 }]}>
                No available slots at the moment.
              </Text>
            )}

            <Image
              source={require('@/assets/images/booking-time-characters.png')}
              style={{
                width: contentWidth * (291.7 / 300.3),
                height: contentWidth * (291.7 / 300.3) * CHARACTERS_RATIO,
                alignSelf: 'center',
                // Trimmed from the comp's 103dp to absorb the taller header,
                // larger row and lifted footer.
                marginTop: 76,
              }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </View>
        )}

        {/* Budget Selection */}
        {currentStep === 'budget' && (
          <View style={{ width: contentWidth }}>
            <Text style={styles.stepTitleCentred}>What&apos;s your range?</Text>
            {/* The comp misspells this as "bugets"; kept spelled. */}
            <Text style={styles.stepSubtitleCentred}>This helps us match similar budgets</Text>

            <View style={{ marginTop: 32, gap: 30 }}>
              {BUDGET_BANDS.map((band) => (
                <FlowPanel
                  key={band.value}
                  label={band.label}
                  selected={selectedBudget === band.value}
                  onPress={() => setSelectedBudget(band.value)}
                  width={contentWidth}
                />
              ))}
            </View>

            <Image
              source={require('@/assets/images/booking-budget-notes.png')}
              style={{
                width: contentWidth * BUDGET_NOTES_SCALE,
                height: contentWidth * BUDGET_NOTES_SCALE * BUDGET_NOTES_RATIO,
                alignSelf: 'center',
                marginTop: 24,
              }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </View>
        )}

        {/* Group Preference Selection */}
        {currentStep === 'preference' && (
          <View style={{ width: contentWidth }}>
            {/* "your room" is the comp's wording over the spec's "the room". */}
            <Text style={styles.stepTitleCentred}>Who&apos;s in your room?</Text>
            <Text style={styles.stepSubtitleCentred}>Choose your group dynamic</Text>

            {/* Panels sit exactly where the budget step leaves them: both
                comps place all three at the same y, so the boxes hold still
                as the student moves from one step to the next. */}
            <View style={{ marginTop: 32, gap: 30 }}>
              {GROUP_PREFERENCES.map((pref) => (
                <FlowPanel
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
          <View style={{ width: contentWidth }}>
            {/* Comp reads "Your new adventure awaits" / "Unlock your new
                adventure". Kept as "next": that is the wording in
                docs/PRODUCT_SPEC.md §1.6's Step 5 mockup and in the two other
                screens that echo it (Home's subtitle, Bookings' empty state),
                so switching this one screen to "new" would leave the phrase
                inconsistent in three places. */}
            <Text style={styles.stepTitleCentred}>Your adventure awaits</Text>
            <Text style={styles.stepSubtitleCentred}>Confirm your choices</Text>

            <SummaryCard
              width={contentWidth}
              style={{ marginTop: 58 }}
              rows={[
                {
                  icon: activityIcon,
                  label: activity.name,
                },
                {
                  icon: SUMMARY_ICONS.slot,
                  label: selectedSlotRow
                    ? formatSlotDateTime(selectedSlotRow.slot_datetime, activity.name)
                    : '',
                  onPress: () => goToStep('time'),
                },
                {
                  icon: SUMMARY_ICONS.group,
                  label: `Group of ${formatGroupSize(activity.min_group_size, activity.max_group_size)}`,
                  // The comp shows this row as a single line, but its own
                  // example activity does collect a gender preference and has
                  // nowhere to show it. Appending it to the label overflows
                  // the row (the label has ~170dp between badge and chevron,
                  // and "Group of 4–5 · Surprise me (mixed)" needs far more),
                  // and the row can't grow because the divider under it is
                  // drawn into the card art — so it goes on a second line
                  // inside the same band, which has the height for it.
                  detail: steps.includes('preference')
                    ? GROUP_PREFERENCES.find((p) => p.value === selectedPreference)?.label
                    : undefined,
                  onPress: steps.includes('preference')
                    ? () => goToStep('preference')
                    : undefined,
                },
                {
                  icon: SUMMARY_ICONS.money,
                  // The card has room for exactly four rows (see
                  // SummaryCard), and the comp fills the fourth with the
                  // budget band. Activities that never ask for one (Movies,
                  // and the fixed-duration Sports games) would leave that
                  // band empty, so they show what they are actually paying
                  // there instead — the same money row, carrying the figure
                  // it does have.
                  label: steps.includes('budget')
                    ? BUDGET_BANDS.find((b) => b.value === selectedBudget)?.label ?? ''
                    : `₹${totalFee}`,
                  onPress: steps.includes('budget') ? () => goToStep('budget') : undefined,
                },
              ]}
            />

            <SummaryToggleRow
              label="Bring a +1"
              icon={SUMMARY_ICONS.gift}
              selected={plusOne}
              width={contentWidth}
              style={{ marginTop: 35 }}
              onPress={() => {
                setPlusOne(!plusOne);
                if (plusOne) setFriendName('');
              }}
            />

            {plusOne && (
              <View style={{ marginTop: 20 }}>
                {/* Comp labels this "Your Name", but the field is the +1's
                    name — the student's own is already on their profile, and
                    this value is stored as the guest's. Labelled for what it
                    collects. */}
                <Text style={styles.fieldLabel}>Their Name</Text>
                <FlowField
                  width={contentWidth}
                  style={{ marginTop: 15 }}
                  value={friendName}
                  onChangeText={(text) => {
                    setFriendName(text);
                    setError('');
                  }}
                  placeholder="Their name"
                />
              </View>
            )}

            {/* Price preview — required by docs/PRODUCT_SPEC.md §1.6's Step 5
                mockup ("₹25 to unlock this evening"), which the comp has no
                row for, so it sits here where it reads as the amount the
                button below is about to charge. Sports additionally has a
                known duration to caption. */}
            <Text style={styles.priceCaption}>
              <Text style={styles.priceValue}>₹{totalFee}</Text>
              {activity.duration_minutes != null
                ? ` for ${formatDuration(activity.duration_minutes)}${plusOne ? ', plus your +1' : ''}? Steal.`
                : ` to unlock your invitation${plusOne ? ', plus your +1' : ''}.`}
            </Text>
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      {/* Navigation buttons, held clear of whatever safe area the device
          reports so the spacing holds on both gesture and 3-button nav. Lifted
          past the comp's own margin at the founder's request. */}
      <View
        style={{
          width: contentWidth,
          alignSelf: 'center',
          paddingBottom: 64 + insets.bottom,
          paddingTop: 12,
        }}>
        <FlowBackButton onPress={handleBack} />

        <View style={{ marginTop: 18 }}>
          <FlowPillButton
            label={currentStep === 'summary' ? 'Unlock Your Next Adventure' : 'Next  →'}
            onPress={handleNext}
            loading={isLoading}
            disabled={!canProceedToNextStep()}
            width={contentWidth}
          />
        </View>
      </View>
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
    // Comp seats the title's cap 66dp down the screen; pushed further at the
    // founder's request so the header clears the status bar more comfortably.
    paddingTop: 88,
    paddingHorizontal: 16,
  },
  // The redesign's type now lives in constants/flow-theme.ts, so profile
  // creation, the quiz and the profile tab set their headings from the same
  // place this screen does. Only the per-use spacing stays here.
  flowTitle: FlowText.title,
  flowSubtitle: {
    ...FlowText.subtitle,
    marginTop: 14,
  },
  stepTitleCentred: FlowText.titleCentred,
  stepSubtitleCentred: {
    ...FlowText.subtitleItalic,
    marginTop: 2,
    textAlign: 'center' as const,
  },
  slotLabel: {
    ...FlowText.rowLabel,
    flex: 1,
  },
  // Sits above the +1's name field. The UI PAGE 5 comp sets it small and
  // quiet, at a 8dp cap.
  fieldLabel: {
    ...FlowText.subtitle,
    fontSize: 13.5,
  },
  /**
   * The spec-required price line, which the comp has no row for. Set as one
   * centred sentence with the figure carrying the emphasis, rather than the
   * old cream card's big stacked number — at this size, under a card of
   * evenly weighted rows, a 34dp numeral would outshout the heading.
   */
  priceCaption: {
    ...FlowText.subtitle,
    fontSize: 13.5,
    textAlign: 'center',
    marginTop: 26,
  },
  priceValue: {
    fontFamily: FontFamily.accent.interBold,
    fontSize: 15,
  },
  // Still used by this screen's load-failure and booking-blocked states,
  // which have no comp of their own yet.
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
  error: {
    ...FlowText.error,
    marginTop: 16,
    paddingHorizontal: 8,
  },
});
