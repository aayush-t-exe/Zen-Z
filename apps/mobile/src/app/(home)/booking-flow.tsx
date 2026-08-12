import { useState, useEffect } from 'react';
import {
  View,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';

interface Slot {
  id: string;
  slot_datetime: string;
  activity_type_id: number;
}

interface Activity {
  id: number;
  name: string;
  emoji: string;
}

const BUDGET_BANDS = [
  { value: 'under_300', label: 'Under ₹300' },
  { value: '300_600', label: '₹300–600' },
  { value: '600_plus', label: '₹600+' },
];

const GROUP_PREFERENCES = [
  { value: 'mixed', label: 'Surprise me (mixed)' },
  { value: 'women_only', label: 'Women only' },
];

export default function BookingFlowScreen() {
  const router = useRouter();
  const { activityId } = useLocalSearchParams<{ activityId: string }>();
  const user = useAuthStore((state) => state.user);

  const [step, setStep] = useState(1);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<string | null>(null);
  const [selectedPreference, setSelectedPreference] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { width } = useWindowDimensions();
  const activityNumId = parseInt(activityId || '0');

  useEffect(() => {
    loadActivityAndSlots();
  }, [activityNumId]);

  const loadActivityAndSlots = async () => {
    try {
      setIsLoading(true);

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
  };

  const formatSlotDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = daysOfWeek[date.getDay()];
    const time = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${dayName} · ${time}`;
  };

  const handleCreateBooking = async () => {
    if (!selectedSlot || !selectedBudget || !selectedPreference || !user) {
      setError('Please select all options');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { error: bookingError } = await supabase.from('bookings').insert({
        user_id: user.id,
        slot_id: selectedSlot,
        budget_band: selectedBudget,
        group_preference: selectedPreference,
        status: 'pending_match',
      });

      if (bookingError) {
        setError(bookingError.message);
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
    if (step === 2) return selectedSlot;
    if (step === 3) return selectedBudget;
    if (step === 4) return selectedPreference;
    return true;
  };

  const handleNext = () => {
    if (step < 5) {
      setStep(step + 1);
    } else {
      handleCreateBooking();
    }
  };

  if (isLoading && !activity) {
    return (
      <ThemedView className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  return (
    <ThemedView className="flex-1">
      <ScrollView className="flex-1 px-6 py-8">
        {/* Step counter */}
        <View className="mb-6">
          <ThemedText type="default" themeColor="textSecondary" className="text-sm">
            Step {step} of 5
          </ThemedText>
        </View>

        {/* Step 1: Activity Summary */}
        {step === 1 && activity && (
          <View className="gap-6">
            <View className="gap-3">
              <ThemedText type="title" className="text-2xl">
                Ready to book?
              </ThemedText>
              <ThemedText type="default" themeColor="textSecondary">
                Let's find you the perfect {activity.name.toLowerCase()} group.
              </ThemedText>
            </View>

            <View className="rounded-2xl bg-white px-6 py-8 dark:bg-gray-900">
              <View className="gap-4 items-center">
                <ThemedText className="text-6xl">{activity.emoji}</ThemedText>
                <ThemedText className="text-2xl font-bold text-center">
                  {activity.name}
                </ThemedText>
                <ThemedText type="default" themeColor="textSecondary" className="text-center">
                  Group of 4–5 · {activity.name === 'Movie' ? 'Unlock a seat' : 'Unlock a table'}
                </ThemedText>
              </View>
            </View>
          </View>
        )}

        {/* Step 2: Day & Time Selection */}
        {step === 2 && (
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
                    onPress={() => setSelectedSlot(slot.id)}
                    className={`rounded-lg px-4 py-3 ${
                      selectedSlot === slot.id
                        ? 'bg-white'
                        : 'border border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <ThemedText
                      className={selectedSlot === slot.id ? 'font-semibold' : ''}
                    >
                      ○ {formatSlotDateTime(slot.slot_datetime)}
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

        {/* Step 3: Budget Selection */}
        {step === 3 && (
          <View className="gap-4">
            <View className="gap-2">
              <ThemedText type="title" className="text-xl">
                What's your range?
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
                    className={selectedBudget === band.value ? 'font-semibold' : ''}
                  >
                    ○ {band.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Step 4: Group Preference Selection */}
        {step === 4 && (
          <View className="gap-4">
            <View className="gap-2">
              <ThemedText type="title" className="text-xl">
                Who's in the room?
              </ThemedText>
              <ThemedText type="default" themeColor="textSecondary" className="text-sm">
                Choose your group dynamic
              </ThemedText>
            </View>

            <View className="gap-2">
              {GROUP_PREFERENCES.map((pref) => (
                <Pressable
                  key={pref.value}
                  onPress={() => setSelectedPreference(pref.value)}
                  className={`rounded-lg px-4 py-3 ${
                    selectedPreference === pref.value
                      ? 'bg-white'
                      : 'border border-gray-300 dark:border-gray-600'
                  }`}
                >
                  <ThemedText
                    className={selectedPreference === pref.value ? 'font-semibold' : ''}
                  >
                    ○ {pref.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Step 5: Confirmation */}
        {step === 5 && activity && selectedSlot && selectedBudget && selectedPreference && (
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
                    Group of 4–5 ·{' '}
                    {selectedPreference === 'women_only' ? 'Women only' : 'Surprise me (mixed)'}
                  </ThemedText>
                </View>

                {/* Budget */}
                <View className="gap-2">
                  <ThemedText type="default" themeColor="textSecondary" className="text-xs">
                    Budget
                  </ThemedText>
                  <ThemedText className="text-lg font-semibold">
                    {BUDGET_BANDS.find((b) => b.value === selectedBudget)?.label}
                  </ThemedText>
                </View>

                {/* Price to unlock */}
                <View className="border-t border-gray-300 pt-4 dark:border-gray-700">
                  <ThemedText type="default" themeColor="textSecondary" className="text-xs">
                    To unlock this evening
                  </ThemedText>
                  <ThemedText className="text-xl font-bold">₹25</ThemedText>
                </View>
              </View>
            </View>
          </View>
        )}

        {error && (
          <ThemedText type="default" className="mt-4 text-red-500">
            {error}
          </ThemedText>
        )}
      </ScrollView>

      {/* Navigation buttons */}
      <View className="gap-3 px-6 pb-8">
        {step > 1 && (
          <Pressable
            onPress={() => setStep(step - 1)}
            className="rounded-lg border border-gray-300 py-3 px-4 dark:border-gray-600"
          >
            <ThemedText className="text-center font-semibold">← Back</ThemedText>
          </Pressable>
        )}

        <Pressable
          onPress={handleNext}
          disabled={!canProceedToNextStep() || isLoading}
          className="rounded-lg bg-white py-3 px-4 disabled:opacity-50"
        >
          {isLoading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <ThemedText className="text-center font-semibold text-black">
              {step === 5 ? 'Unlock Your Next Adventure' : 'Next →'}
            </ThemedText>
          )}
        </Pressable>
      </View>
    </ThemedView>
  );
}
