'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface Activity {
  id: number;
  name: string;
  emoji: string;
}

interface Booking {
  id: string;
  user_id: string;
  slot_id: string;
  budget_band: string;
  group_preference: string;
  profile: {
    id: string;
    full_name: string;
    gender: string;
    year_of_study: number;
    photo_url: string | null;
  };
  personality_scores: Array<{
    dimension_id: number;
    score: number;
  }>;
}

interface ActivitySlot {
  id: string;
  activity_type_id: number;
  slot_datetime: string;
}

export default function MatchingPage() {
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null);
  const [slots, setSlots] = useState<ActivitySlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [unmatched, setUnmatched] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push('/login');
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    const fetchActivities = async () => {
      const { data } = await supabase
        .from('activity_types')
        .select('*')
        .eq('is_live', true);
      if (data) {
        setActivities(data);
        if (data.length > 0) {
          setSelectedActivityId(data[0].id);
        }
      }
    };
    fetchActivities();
  }, []);

  useEffect(() => {
    if (!selectedActivityId) return;

    const fetchSlotsAndBookings = async () => {
      setLoading(true);
      setError('');

      try {
        // Fetch slots for this activity
        const { data: slotData } = await supabase
          .from('slots')
          .select('*')
          .eq('activity_type_id', selectedActivityId)
          .eq('status', 'open')
          .gt('slot_datetime', new Date().toISOString())
          .order('slot_datetime', { ascending: true });

        if (slotData) {
          setSlots(slotData);
          if (slotData.length > 0 && !selectedSlotId) {
            setSelectedSlotId(slotData[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching slots:', err);
        setError('Failed to load slots');
      } finally {
        setLoading(false);
      }
    };

    fetchSlotsAndBookings();
  }, [selectedActivityId, selectedSlotId]);

  useEffect(() => {
    if (!selectedSlotId) return;

    const fetchUnmatchedBookings = async () => {
      try {
        const { data } = await supabase
          .from('bookings')
          .select(`
            id,
            user_id,
            slot_id,
            budget_band,
            group_preference,
            profile:user_id (
              id,
              full_name,
              gender,
              year_of_study,
              photo_url
            )
          `)
          .eq('slot_id', selectedSlotId)
          .eq('status', 'pending_match');

        if (data) {
          // Fetch personality scores for each booking
          const bookingsWithScores = await Promise.all(
            data.map(async (booking: any) => {
              const { data: scores } = await supabase
                .from('personality_scores')
                .select('*')
                .eq('user_id', booking.user_id);
              return {
                ...booking,
                personality_scores: scores || [],
              };
            })
          );
          setUnmatched(bookingsWithScores);
        }
      } catch (err) {
        console.error('Error fetching unmatched bookings:', err);
        setError('Failed to load bookings');
      }
    };

    fetchUnmatchedBookings();
  }, [selectedSlotId]);

  const formatSlotDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = daysOfWeek[date.getDay()];
    const time = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${dayName} · ${time}`;
  };

  const selectedActivity = activities.find(a => a.id === selectedActivityId);
  const selectedSlot = slots.find(s => s.id === selectedSlotId);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-blue-600 hover:text-blue-800">
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-bold">Matching Queue</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Activity & Slot Selection */}
        <div className="bg-white rounded-lg border p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Activity
              </label>
              <div className="grid grid-cols-1 gap-2">
                {activities.map(activity => (
                  <button
                    key={activity.id}
                    onClick={() => {
                      setSelectedActivityId(activity.id);
                      setSelectedSlotId(null);
                    }}
                    className={`p-3 rounded-lg border text-left transition ${
                      selectedActivityId === activity.id
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'hover:border-gray-400'
                    }`}
                  >
                    <span className="text-xl mr-2">{activity.emoji}</span>
                    <span className="font-medium">{activity.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Slot
              </label>
              {slots.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                  {slots.map(slot => (
                    <button
                      key={slot.id}
                      onClick={() => setSelectedSlotId(slot.id)}
                      className={`p-3 rounded-lg border text-left transition ${
                        selectedSlotId === slot.id
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'hover:border-gray-400'
                      }`}
                    >
                      {formatSlotDateTime(slot.slot_datetime)}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No slots available</p>
              )}
            </div>
          </div>
        </div>

        {/* Current Selection Summary */}
        {selectedActivity && selectedSlot && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
            <p className="text-blue-900">
              <span className="font-semibold">{selectedActivity.emoji} {selectedActivity.name}</span>
              {' '} • {formatSlotDateTime(selectedSlot.slot_datetime)}
            </p>
          </div>
        )}

        {/* Unmatched Bookings */}
        {selectedSlotId && (
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-xl font-bold mb-2">Unmatched Students</h2>
            <p className="text-gray-600 mb-6">
              {unmatched.length} student{unmatched.length !== 1 ? 's' : ''} waiting for matching
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
              </div>
            ) : unmatched.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 text-lg">✨ All students matched!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unmatched.map(booking => (
                  <StudentCard
                    key={booking.id}
                    booking={booking}
                    onViewProfile={() => {
                      // Navigate to profile view
                      router.push(`/student/${booking.user_id}`);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Matching Board Notice */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-900 text-sm">
            <span className="font-semibold">💡 Matching board coming next:</span> Drag-and-drop interface to create groups and assign venues
          </p>
        </div>
      </main>
    </div>
  );
}

function StudentCard({
  booking,
  onViewProfile,
}: {
  booking: Booking;
  onViewProfile: () => void;
}) {
  const profile = booking.profile;

  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition">
      <div className="flex gap-4 items-start mb-4">
        {profile.photo_url ? (
          <img
            src={profile.photo_url}
            alt={profile.full_name}
            className="w-12 h-12 rounded-lg object-cover bg-gray-200"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center">
            📷
          </div>
        )}
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{profile.full_name}</h3>
          <p className="text-sm text-gray-600">
            {profile.gender.charAt(0).toUpperCase()} · {profile.year_of_study}{getYearSuffix(profile.year_of_study)} yr
          </p>
        </div>
      </div>

      <div className="space-y-2 text-sm mb-4">
        <div>
          <span className="text-gray-600">Budget:</span>
          <span className="ml-2 font-medium">{formatBudget(booking.budget_band)}</span>
        </div>
        <div>
          <span className="text-gray-600">Preference:</span>
          <span className="ml-2 font-medium">
            {booking.group_preference === 'women_only' ? 'Women only' : 'Mixed'}
          </span>
        </div>
      </div>

      <button
        onClick={onViewProfile}
        className="w-full text-center py-2 px-3 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm font-medium text-gray-700"
      >
        View Full Profile
      </button>
    </div>
  );
}

function getYearSuffix(year: number): string {
  if (year === 1) return 'st';
  if (year === 2) return 'nd';
  if (year === 3) return 'rd';
  if (year === 4) return 'th';
  return 'th';
}

function formatBudget(band: string): string {
  const budgets: Record<string, string> = {
    'under_300': 'Under ₹300',
    '300_600': '₹300–600',
    '600_plus': '₹600+',
  };
  return budgets[band] || band;
}
