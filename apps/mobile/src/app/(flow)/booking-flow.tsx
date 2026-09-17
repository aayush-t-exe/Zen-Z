import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FontFamily } from '@/constants/fonts';
import { ACTIVITY_ART_BADGE_SCALE, activityArt } from '@/constants/activity-art';
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

interface Movie {
  id: string;
  title: string;
  price: number;
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
// skips only the budget step, not preference. Movies alone also asks one
// more thing: whether the founder should just pick the film (the default —
// the founder's safety valve for matching, see 0086_movies.sql) or the
// student wants to choose from what's currently showing, which becomes a
// hard matching constraint the same way group_preference already is.
type BookingStep = 'time' | 'budget' | 'preference' | 'movie_choice' | 'summary';
const STEPS_WITH_BUDGET: BookingStep[] = ['time', 'budget', 'preference', 'summary'];
const STEPS_FIXED_PRICE: BookingStep[] = ['time', 'summary'];
const STEPS_MOVIES: BookingStep[] = ['time', 'preference', 'movie_choice', 'summary'];

const GROUP_PREFERENCES = [
  { value: 'mixed', label: 'Surprise me (mixed)' },
  { value: 'women_only', label: 'Women only' },
  { value: 'men_only', label: 'Men only' },
];

const MOVIE_CHOICE_TYPES = [
  { value: 'surprise_me', label: 'Surprise me' },
  { value: 'choose_movie', label: 'Choose your movie' },
];

/**
 * Feeds the summary card's activity row, which sits in a dark badge — the
 * same badge the Home grid puts the founder's 3D activity renders on, so this
 * row carries that render rather than the cream line illustration it used to.
 * A Sports booking carries the specific game's name (not "Sports"), which
 * constants/activity-art.ts keys for.
 *
 * The UI PAGE 5 comp's own example is a Dinner and it drew that row's glyph as
 * line art (icon-dinners-line.png) — kept for Dinners at the comp's scale, so
 * the one row the founder actually approved still looks like the comp.
 */
const activityIconFor = (name: string): SummaryIcon =>
  name === 'Dinners'
    ? SUMMARY_ICONS.dinners
    : { source: activityArt(name), scale: ACTIVITY_ART_BADGE_SCALE };

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
  const [movies, setMovies] = useState<Movie[]>([]);
  const [selectedMovieChoiceType, setSelectedMovieChoiceType] = useState<
    'surprise_me' | 'choose_movie' | null
  >(null);
  const [selectedMovieId, setSelectedMovieId] = useState<string | null>(null);
  const [plusOne, setPlusOne] = useState(false);
  const [friendName, setFriendName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [blockedUntil, setBlockedUntil] = useState<string | null>(null);
  const [profileGender, setProfileGender] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const activityNumId = parseInt(activityId || '0');
  const steps = activity?.duration_minutes
    ? STEPS_FIXED_PRICE
    : activity?.name === 'Movies'
    ? STEPS_MOVIES
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
    setMovies([]);
    setSelectedMovieChoiceType(null);
    setSelectedMovieId(null);
    setPlusOne(false);
    setFriendName('');
    setError('');
  }

  const loadActivityAndSlots = useCallback(async () => {
    try {
      setIsLoading(true);
      setBlockedUntil(null);
      setLoadError(null);

      // These four reads don't depend on each other's results — movies and
      // slots only need activityNumId, already known from the route params,
      // not anything from the activity row itself — so firing them together
      // turns this screen's load into one round trip instead of three or
      // four sequential ones (profile, then activity, then movies, then
      // slots) stacked back to back. The movies query runs unconditionally
      // even for a non-Movies activity; it just comes back empty for that
      // activity_type_id, which is cheap and simpler than gating it on a
      // result (actData.name) this batch doesn't have yet.
      const [profileResult, activityResult, moviesResult, slotsResult] = await Promise.all([
        user
          ? supabase
              .from('profiles')
              .select('booking_blocked_until, gender')
              .eq('id', user.id)
              .single()
          : Promise.resolve(null),
        supabase.from('activity_types').select('*').eq('id', activityNumId).single(),
        supabase
          .from('movies')
          .select('id, title, price')
          .eq('activity_type_id', activityNumId)
          .eq('is_available', true)
          .order('title', { ascending: true }),
        // Only the single nearest open slot — offering weeks of Tuesdays to
        // choose from read like a duplicate ("2 slots for Movies") when
        // really it was next week's slot opening early. One fixed weekly
        // slot at a time matches the actual product model.
        //
        // The lower bound mirrors the midnight-IST cutoff enforced by the
        // "own bookings insert" RLS policy — a slot inside that window
        // would fail on submit anyway, so it's excluded here rather than
        // shown and then rejected.
        supabase
          .from('slots')
          .select('*')
          .eq('activity_type_id', activityNumId)
          .eq('status', 'open')
          .gte('slot_datetime', getBookingCutoffInstant().toISOString())
          .lt('slot_datetime', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
          .order('slot_datetime', { ascending: true })
          .limit(1),
      ]);

      if (profileResult?.error) {
        setLoadError(profileResult.error.message);
        return;
      }

      const profile = profileResult?.data;
      setProfileGender(profile?.gender ?? null);

      if (profile?.booking_blocked_until && new Date(profile.booking_blocked_until) > new Date()) {
        setBlockedUntil(profile.booking_blocked_until);
        return;
      }

      if (activityResult.error) {
        setLoadError(activityResult.error.message);
        return;
      }

      const actData = activityResult.data;
      if (actData) setActivity(actData);

      if (actData?.name === 'Movies') {
        if (moviesResult.error) {
          setLoadError(moviesResult.error.message);
          return;
        }
        setMovies(moviesResult.data ?? []);
      }

      if (slotsResult.error) {
        setLoadError(slotsResult.error.message);
        return;
      }
      const slotData = slotsResult.data;

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
          // resumed=1 tells payment.tsx it got here via this redirect, not
          // by just finishing a fresh booking — a paid booking then shows
          // an extra line explaining why re-tapping this activity landed
          // here instead of letting the student book again.
          router.replace({
            pathname: '/payment' as any,
            params: { slotId: slotData[0].id, resumed: '1' },
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
    const movieChoiceStepRequired = steps.includes('movie_choice');
    if (
      !selectedSlot ||
      (budgetRequired && !selectedBudget) ||
      (preferenceRequired && !selectedPreference) ||
      (movieChoiceStepRequired &&
        (!selectedMovieChoiceType ||
          (selectedMovieChoiceType === 'choose_movie' && !selectedMovieId))) ||
      !user
    ) {
      setError('Please select all options');
      return;
    }

    if (plusOne && !friendName.trim()) {
      setError("Who are you bringing? Add their name, or turn off Bring a +1.");
      // Same reasoning as the toggle-on scroll above: the Their Name field
      // and this error both sit at the bottom of the summary, so a student
      // who scrolled back up to review the rest of the summary before
      // tapping Next never sees why the button didn't go through.
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      });
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
        movie_choice_type: movieChoiceStepRequired ? selectedMovieChoiceType : null,
        movie_id:
          movieChoiceStepRequired && selectedMovieChoiceType === 'choose_movie'
            ? selectedMovieId
            : null,
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
    if (currentStep === 'movie_choice') {
      return selectedMovieChoiceType === 'surprise_me'
        ? true
        : selectedMovieChoiceType === 'choose_movie' && !!selectedMovieId;
    }
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

  const activityIcon = activity ? activityIconFor(activity.name) : SUMMARY_ICONS.slot;
  const selectedSlotRow = slots.find((slot) => slot.id === selectedSlot) ?? null;
  // A choose_movie pick prices against that specific title (a new release
  // can cost more than the usual flat fee, see 0088_movie_price.sql) —
  // surprise_me never learns which movie it'll get until the founder
  // assigns one post-match, so it always pays the flat activity fee.
  const selectedMovie = movies.find((m) => m.id === selectedMovieId) ?? null;
  const baseFee =
    selectedMovieChoiceType === 'choose_movie' && selectedMovie
      ? selectedMovie.price
      : (activity?.convenience_fee ?? 0);
  const totalFee = plusOne ? baseFee * 2 : baseFee;

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
    <KeyboardAvoidingView
      style={styles.root}
      // Same fix as group/[groupId].tsx's message input: without this, the
      // keyboard could cover the "+1" name field entirely on Android with
      // nothing pushing it back into view, forcing a manual scroll to see
      // what was being typed.
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>

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

        {/* Movie Choice Selection — Movies only, see 0086_movies.sql. Surprise
            me is drawn first (and reads as the plain, safe choice) since it's
            the founder's safety valve for matching a thin pool of students. */}
        {currentStep === 'movie_choice' && (
          <View style={{ width: contentWidth }}>
            <Text style={styles.stepTitleCentred}>Know what you want to watch?</Text>
            <Text style={styles.stepSubtitleCentred}>Leave it to us, or pick the film yourself</Text>

            <View style={{ marginTop: 32, gap: 30 }}>
              {MOVIE_CHOICE_TYPES.map((choice) => (
                <FlowPanel
                  key={choice.value}
                  label={choice.label}
                  selected={selectedMovieChoiceType === choice.value}
                  onPress={() => {
                    setError('');
                    setSelectedMovieChoiceType(choice.value as 'surprise_me' | 'choose_movie');
                    if (choice.value === 'surprise_me') setSelectedMovieId(null);
                  }}
                  width={contentWidth}
                />
              ))}
            </View>

            {selectedMovieChoiceType === 'choose_movie' && (
              <View style={{ marginTop: 30, gap: 16 }}>
                <Text style={styles.fieldLabel}>Now showing</Text>
                {movies.length === 0 ? (
                  <Text style={styles.stepSubtitleCentred}>
                    Nothing listed yet — try Surprise me instead for this one.
                  </Text>
                ) : (
                  <View style={{ gap: 14 }}>
                    {movies.map((movie) => (
                      <FlowPanel
                        key={movie.id}
                        label={movie.title}
                        selected={selectedMovieId === movie.id}
                        onPress={() => {
                          setError('');
                          setSelectedMovieId(movie.id);
                        }}
                        width={contentWidth}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Confirmation */}
        {currentStep === 'summary' &&
          activity &&
          selectedSlot &&
          (steps.includes('budget') ? selectedBudget : true) &&
          (steps.includes('preference') ? selectedPreference : true) &&
          (steps.includes('movie_choice') ? !!selectedMovieChoiceType : true) && (
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
                  // The card has no spare row for this (see SummaryCard —
                  // exactly four, art-locked), and this row is otherwise the
                  // only one with a free detail line, so the movie choice
                  // rides on it instead of getting its own.
                  detail: steps.includes('movie_choice')
                    ? selectedMovieChoiceType === 'choose_movie'
                      ? movies.find((m) => m.id === selectedMovieId)?.title
                      : 'Surprise me'
                    : undefined,
                  onPress: steps.includes('movie_choice') ? () => goToStep('movie_choice') : undefined,
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
                const turningOn = !plusOne;
                setPlusOne(turningOn);
                if (!turningOn) setFriendName('');
                if (turningOn) {
                  // The "Their Name" field only mounts once this flips true,
                  // below whatever's already on screen — without this,
                  // students who don't think to scroll never see it, then
                  // hit "required" on Next with no idea why.
                  requestAnimationFrame(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  });
                }
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
    </KeyboardAvoidingView>
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
