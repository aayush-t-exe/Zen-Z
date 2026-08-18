import { useState, useCallback } from 'react';
import { View, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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

export default function BookingFlowScreen() {
  const router = useRouter();
  const { activityId } = useLocalSearchParams<{ activityId: string }>();
  const user = useAuthStore((state) => state.user);

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
    if (currentStep === 'budget') return selectedBudget;
    if (currentStep === 'preference') return selectedPreference;
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
      <ThemedView className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  if (blockedUntil) {
    return (
      <ThemedView className="flex-1 items-center justify-center px-6">
        <ThemedText className="mb-2 text-3xl">🕯️</ThemedText>
        <ThemedText type="title" className="text-center text-lg">
          Your invitations are paused.
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" className="mt-2 text-center text-sm">
          Three empty seats in a row does that. Check back {formatSlotDateTime(blockedUntil)}.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView className="flex-1">
      <ScrollView className="flex-1 px-6 py-8">
        {/* Step counter + activity context */}
        <View className="mb-6 gap-1">
          <ThemedText type="default" themeColor="textSecondary" className="text-sm">
            Step {stepIndex + 1} of {steps.length}
          </ThemedText>
          {activity && (
            <ThemedText type="default" className="text-sm">
              {activity.emoji} {activity.name}
            </ThemedText>
          )}
        </View>

        {/* Day & Time Selection */}
        {currentStep === 'time' && (
          <View className="gap-4">
            <View className="gap-2">
              <ThemedText type="title" className="text-xl">
                When do you want your story to begin?
              </ThemedText>
              <ThemedText type="default" themeColor="textSecondary" className="text-sm">
                Pick a fixed weekly slot
              </ThemedText>
            </View>

            {slots.length > 0 ? (
              <View className="gap-2">
                {slots.map((slot) => (
                  <Pressable
                    key={slot.id}
                    onPress={() => setSelectedSlot(selectedSlot === slot.id ? null : slot.id)}
                    className={`rounded-lg px-4 py-3 ${
                      selectedSlot === slot.id
                        ? 'bg-white'
                        : 'border border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <ThemedText
                      themeColor={selectedSlot === slot.id ? 'onLight' : undefined}
                      className={selectedSlot === slot.id ? 'font-semibold' : ''}
                    >
                      {selectedSlot === slot.id ? '●' : '○'} {formatSlotDateTime(slot.slot_datetime)}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            ) : (
              <ThemedText type="default" themeColor="textSecondary">
                No available slots at the moment.
              </ThemedText>
            )}
          </View>
        )}

        {/* Budget Selection */}
        {currentStep === 'budget' && (
          <View className="gap-4">
            <View className="gap-2">
              <ThemedText type="title" className="text-xl">
                What&apos;s your range?
              </ThemedText>
              <ThemedText type="default" themeColor="textSecondary" className="text-sm">
                This helps us match similar budgets
              </ThemedText>
            </View>

            <View className="gap-2">
              {BUDGET_BANDS.map((band) => (
                <Pressable
                  key={band.value}
                  onPress={() => setSelectedBudget(band.value)}
                  className={`rounded-lg px-4 py-3 ${
                    selectedBudget === band.value
                      ? 'bg-white'
                      : 'border border-gray-300 dark:border-gray-600'
                  }`}
                >
                  <ThemedText
                    themeColor={selectedBudget === band.value ? 'onLight' : undefined}
                    className={selectedBudget === band.value ? 'font-semibold' : ''}
                  >
                    ○ {band.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Group Preference Selection */}
        {currentStep === 'preference' && (
          <View className="gap-4">
            <View className="gap-2">
              <ThemedText type="title" className="text-xl">
                Who&apos;s in the room?
              </ThemedText>
              <ThemedText type="default" themeColor="textSecondary" className="text-sm">
                Choose your group dynamic
              </ThemedText>
            </View>

            <View className="gap-2">
              {GROUP_PREFERENCES.map((pref) => (
                <Pressable
                  key={pref.value}
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
                  className={`rounded-lg px-4 py-3 ${
                    selectedPreference === pref.value
                      ? 'bg-white'
                      : 'border border-gray-300 dark:border-gray-600'
                  }`}
                >
                  <ThemedText
                    themeColor={selectedPreference === pref.value ? 'onLight' : undefined}
                    className={selectedPreference === pref.value ? 'font-semibold' : ''}
                  >
                    ○ {pref.label}
                  </ThemedText>
                </Pressable>
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
          <View className="gap-4">
            <ThemedText type="title" className="text-xl">
              Your adventure awaits
            </ThemedText>

            <View className="rounded-2xl bg-white px-6 py-8 dark:bg-gray-900">
              <View className="gap-6">
                {/* Activity */}
                <View className="gap-2">
                  <ThemedText type="default" themeColor="textSecondary" className="text-xs">
                    Activity
                  </ThemedText>
                  <ThemedText className="text-lg font-semibold">
                    {activity.emoji} {activity.name}
                  </ThemedText>
                </View>

                {/* Date & Time */}
                <View className="gap-2">
                  <ThemedText type="default" themeColor="textSecondary" className="text-xs">
                    When
                  </ThemedText>
                  <ThemedText className="text-lg font-semibold">
                    {slots.find((s) => s.id === selectedSlot) &&
                      formatSlotDateTime(slots.find((s) => s.id === selectedSlot)!.slot_datetime)}
                  </ThemedText>
                </View>

                {/* Group */}
                <View className="gap-2">
                  <ThemedText type="default" themeColor="textSecondary" className="text-xs">
                    Group
                  </ThemedText>
                  <ThemedText className="text-lg font-semibold">
                    Group of {activity.min_group_size}–{activity.max_group_size}
                    {steps.includes('preference') &&
                      ` · ${GROUP_PREFERENCES.find((p) => p.value === selectedPreference)?.label}`}
                  </ThemedText>
                </View>

                {/* Budget (only for activities without a fixed price) */}
                {steps.includes('budget') && (
                  <View className="gap-2">
                    <ThemedText type="default" themeColor="textSecondary" className="text-xs">
                      Budget
                    </ThemedText>
                    <ThemedText className="text-lg font-semibold">
                      {BUDGET_BANDS.find((b) => b.value === selectedBudget)?.label}
                    </ThemedText>
                  </View>
                )}

                {/* Duration & price (fixed-price activities, e.g. Sports) — sized
                    to actually catch the eye, not just sit in the line-up like
                    every other field. */}
                {activity.duration_minutes != null && (
                  <View className="items-center gap-1 rounded-xl bg-yellow-50 py-4 dark:bg-yellow-900/20">
                    <ThemedText themeColor="warning" className="text-4xl font-bold">
                      ₹{activity.convenience_fee}
                    </ThemedText>
                    <ThemedText themeColor="warning" className="text-sm font-semibold">
                      for {formatDuration(activity.duration_minutes)}? Steal.
                    </ThemedText>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {error && (
          <ThemedText type="default" themeColor="error" className="mt-4">
            {error}
          </ThemedText>
        )}
      </ScrollView>

      {/* Navigation buttons */}
      <View className="gap-3 px-6 pb-8">
        <Pressable
          onPress={handleBack}
          className="rounded-lg border border-gray-300 py-3 px-4 dark:border-gray-600"
        >
          <ThemedText className="text-center font-semibold">← Back</ThemedText>
        </Pressable>

        <Pressable
          onPress={handleNext}
          disabled={!canProceedToNextStep() || isLoading}
          className="rounded-lg bg-white py-3 px-4 disabled:opacity-50"
        >
          {isLoading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <ThemedText themeColor="onLight" className="text-center font-semibold">
              {currentStep === 'summary' ? 'Unlock Your Next Adventure' : 'Next →'}
            </ThemedText>
          )}
        </Pressable>
      </View>
    </ThemedView>
  );
}
