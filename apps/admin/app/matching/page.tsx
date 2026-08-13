'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminGuard, AdminAccessDenied, AdminAuthLoading } from '@/lib/adminAuth';
import { formatSlotDateTime } from '@/lib/format';
import Link from 'next/link';
import MatchingBoard from './MatchingBoard';

interface Activity {
  id: number;
  name: string;
  emoji: string;
  min_group_size: number;
  max_group_size: number;
}

interface ActivitySlot {
  id: string;
  activity_type_id: number;
  slot_datetime: string;
}

export default function MatchingPage() {
  const { status } = useAdminGuard();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null);
  const [slots, setSlots] = useState<ActivitySlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status !== 'authorized') return;

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
  }, [status]);

  useEffect(() => {
    if (status !== 'authorized' || !selectedActivityId) return;

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
  }, [status, selectedActivityId, selectedSlotId]);

  const selectedActivity = activities.find(a => a.id === selectedActivityId);
  const selectedSlot = slots.find(s => s.id === selectedSlotId);

  if (status === 'checking') {
    return <AdminAuthLoading />;
  }

  if (status === 'denied') {
    return <AdminAccessDenied />;
  }

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
          <div className="flex items-center gap-4">
            <Link href="/groups" className="text-sm text-blue-600 hover:text-blue-800">
              View groups →
            </Link>
            <Link href="/venues" className="text-sm text-blue-600 hover:text-blue-800">
              Manage venues →
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

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
              {loading ? (
                <p className="text-gray-500 text-sm">Loading slots…</p>
              ) : slots.length > 0 ? (
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

        {/* Matching Board */}
        {selectedSlotId && selectedActivity && (
          <MatchingBoard
            key={selectedSlotId}
            slotId={selectedSlotId}
            activityTypeId={selectedActivity.id}
            minGroupSize={selectedActivity.min_group_size}
            maxGroupSize={selectedActivity.max_group_size}
          />
        )}
      </main>
    </div>
  );
}
