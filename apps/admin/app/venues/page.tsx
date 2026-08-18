'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminGuard, AdminAccessDenied, AdminAuthLoading } from '@/lib/adminAuth';
import Link from 'next/link';

interface ActivityType {
  id: number;
  name: string;
  emoji: string;
}

interface Venue {
  id: string;
  name: string;
  activity_type_id: number | null;
  address: string | null;
  capacity: number | null;
  commission_pct: number | null;
  contact_info: string | null;
  notes: string | null;
  activity_types: { name: string; emoji: string } | null;
}

interface VenueFormState {
  name: string;
  activity_type_id: string;
  address: string;
  capacity: string;
  commission_pct: string;
  contact_info: string;
  notes: string;
}

const EMPTY_FORM: VenueFormState = {
  name: '',
  activity_type_id: '',
  address: '',
  capacity: '',
  commission_pct: '',
  contact_info: '',
  notes: '',
};

export default function VenuesPage() {
  const { status } = useAdminGuard();
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newVenue, setNewVenue] = useState<VenueFormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<VenueFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError('');

    const [{ data: activities }, { data: venuesData, error: venuesError }] = await Promise.all([
      supabase.from('activity_types').select('id, name, emoji').eq('is_live', true).eq('is_bookable', true),
      supabase
        .from('venues')
        .select('*, activity_types:activity_type_id ( name, emoji )')
        .order('name'),
    ]);

    if (activities) setActivityTypes(activities);
    if (venuesError) {
      setError('Failed to load venues');
    } else if (venuesData) {
      setVenues(venuesData as any as Venue[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (status !== 'authorized') return;
    loadData();
  }, [status]);

  const toInsertPayload = (form: VenueFormState) => ({
    name: form.name.trim(),
    activity_type_id: form.activity_type_id ? Number(form.activity_type_id) : null,
    address: form.address.trim() || null,
    capacity: form.capacity ? Number(form.capacity) : null,
    commission_pct: form.commission_pct ? Number(form.commission_pct) : 0,
    contact_info: form.contact_info.trim() || null,
    notes: form.notes.trim() || null,
  });

  const handleCreate = async () => {
    if (!newVenue.name.trim() || !newVenue.activity_type_id) {
      setError('Name and activity are required.');
      return;
    }

    setCreating(true);
    setError('');
    try {
      const { error: insertError } = await supabase.from('venues').insert(toInsertPayload(newVenue));
      if (insertError) throw insertError;
      setNewVenue(EMPTY_FORM);
      await loadData();
    } catch (err: any) {
      console.error('Error creating venue:', err);
      setError(err?.message || 'Failed to create venue.');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (venue: Venue) => {
    setEditingId(venue.id);
    setEditForm({
      name: venue.name,
      activity_type_id: venue.activity_type_id ? String(venue.activity_type_id) : '',
      address: venue.address ?? '',
      capacity: venue.capacity !== null ? String(venue.capacity) : '',
      commission_pct: venue.commission_pct !== null ? String(venue.commission_pct) : '',
      contact_info: venue.contact_info ?? '',
      notes: venue.notes ?? '',
    });
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    if (!editForm.name.trim() || !editForm.activity_type_id) {
      setError('Name and activity are required.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('venues')
        .update(toInsertPayload(editForm))
        .eq('id', editingId);
      if (updateError) throw updateError;
      cancelEdit();
      await loadData();
    } catch (err: any) {
      console.error('Error updating venue:', err);
      setError(err?.message || 'Failed to update venue.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (venue: Venue) => {
    if (!window.confirm(`Delete "${venue.name}"? This can't be undone.`)) return;

    setDeletingId(venue.id);
    setError('');
    try {
      const { error: deleteError } = await supabase.from('venues').delete().eq('id', venue.id);
      if (deleteError) throw deleteError;
      await loadData();
    } catch (err: any) {
      console.error('Error deleting venue:', err);
      setError(
        err?.message?.includes('foreign key')
          ? `Can't delete "${venue.name}" — it's already assigned to a confirmed group.`
          : err?.message || 'Failed to delete venue.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (status === 'checking') {
    return <AdminAuthLoading />;
  }

  if (status === 'denied') {
    return <AdminAccessDenied />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-blue-600 hover:text-blue-800">
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-bold">Venues</h1>
          </div>
          <Link href="/matching" className="text-sm text-blue-600 hover:text-blue-800">
            Go to Matching Queue →
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Add Venue */}
        <div className="bg-white rounded-lg border p-6 mb-8">
          <h2 className="text-lg font-bold mb-4">Add a venue</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Venue name"
              value={newVenue.name}
              onChange={(e) => setNewVenue({ ...newVenue, name: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={newVenue.activity_type_id}
              onChange={(e) => setNewVenue({ ...newVenue, activity_type_id: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Select activity…</option>
              {activityTypes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.emoji} {a.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Address"
              value={newVenue.address}
              onChange={(e) => setNewVenue({ ...newVenue, address: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm md:col-span-2"
            />
            <input
              type="number"
              placeholder="Capacity"
              value={newVenue.capacity}
              onChange={(e) => setNewVenue({ ...newVenue, capacity: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="number"
              placeholder="Commission %"
              value={newVenue.commission_pct}
              onChange={(e) => setNewVenue({ ...newVenue, commission_pct: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Contact info"
              value={newVenue.contact_info}
              onChange={(e) => setNewVenue({ ...newVenue, contact_info: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Notes"
              value={newVenue.notes}
              onChange={(e) => setNewVenue({ ...newVenue, notes: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="mt-4 px-6 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold disabled:bg-gray-300"
          >
            {creating ? 'Adding…' : 'Add Venue'}
          </button>
        </div>

        {/* Venue List */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-bold mb-4">All venues</h2>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
          ) : venues.length === 0 ? (
            <p className="text-gray-500 text-sm">No venues yet — add one above.</p>
          ) : (
            <div className="space-y-4">
              {venues.map((venue) =>
                editingId === venue.id ? (
                  <div key={venue.id} className="border rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="border rounded-lg px-3 py-2 text-sm"
                      />
                      <select
                        value={editForm.activity_type_id}
                        onChange={(e) => setEditForm({ ...editForm, activity_type_id: e.target.value })}
                        className="border rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">Select activity…</option>
                        {activityTypes.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.emoji} {a.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Address"
                        value={editForm.address}
                        onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                        className="border rounded-lg px-3 py-2 text-sm md:col-span-2"
                      />
                      <input
                        type="number"
                        placeholder="Capacity"
                        value={editForm.capacity}
                        onChange={(e) => setEditForm({ ...editForm, capacity: e.target.value })}
                        className="border rounded-lg px-3 py-2 text-sm"
                      />
                      <input
                        type="number"
                        placeholder="Commission %"
                        value={editForm.commission_pct}
                        onChange={(e) => setEditForm({ ...editForm, commission_pct: e.target.value })}
                        className="border rounded-lg px-3 py-2 text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Contact info"
                        value={editForm.contact_info}
                        onChange={(e) => setEditForm({ ...editForm, contact_info: e.target.value })}
                        className="border rounded-lg px-3 py-2 text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Notes"
                        value={editForm.notes}
                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                        className="border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveEdit}
                        disabled={saving}
                        className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold disabled:bg-gray-300"
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key={venue.id} className="border rounded-lg p-4 flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {venue.activity_types?.emoji} {venue.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        {venue.activity_types?.name ?? 'No activity set'}
                        {venue.address && ` · ${venue.address}`}
                        {venue.capacity !== null && ` · Capacity ${venue.capacity}`}
                      </p>
                      {venue.contact_info && (
                        <p className="text-sm text-gray-500 mt-1">Contact: {venue.contact_info}</p>
                      )}
                      {venue.notes && <p className="text-sm text-gray-500 mt-1">{venue.notes}</p>}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => startEdit(venue)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(venue)}
                        disabled={deletingId === venue.id}
                        className="text-sm text-red-600 hover:text-red-800 disabled:text-gray-400"
                      >
                        {deletingId === venue.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
