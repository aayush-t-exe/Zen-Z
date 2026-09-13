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

interface Movie {
  id: string;
  title: string;
  activity_type_id: number | null;
  is_available: boolean;
  notes: string | null;
  activity_types: { name: string; emoji: string } | null;
}

interface MovieFormState {
  title: string;
  activity_type_id: string;
  is_available: boolean;
  notes: string;
}

const EMPTY_FORM: MovieFormState = {
  title: '',
  activity_type_id: '',
  is_available: true,
  notes: '',
};

export default function MoviesPage() {
  const { status } = useAdminGuard();
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newMovie, setNewMovie] = useState<MovieFormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<MovieFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError('');

    const [{ data: activities, error: activitiesError }, { data: moviesData, error: moviesError }] =
      await Promise.all([
        supabase.from('activity_types').select('id, name, emoji').eq('is_live', true).eq('is_bookable', true),
        supabase
          .from('movies')
          .select('*, activity_types:activity_type_id ( name, emoji )')
          .order('title'),
      ]);

    if (activitiesError || moviesError) {
      setError('Failed to load movies');
    } else {
      if (activities) setActivityTypes(activities);
      if (moviesData) setMovies(moviesData as any as Movie[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (status !== 'authorized') return;
    loadData();
  }, [status]);

  const toInsertPayload = (form: MovieFormState) => ({
    title: form.title.trim(),
    activity_type_id: form.activity_type_id ? Number(form.activity_type_id) : null,
    is_available: form.is_available,
    notes: form.notes.trim() || null,
  });

  const handleCreate = async () => {
    if (!newMovie.title.trim() || !newMovie.activity_type_id) {
      setError('Title and activity are required.');
      return;
    }

    setCreating(true);
    setError('');
    try {
      const { error: insertError } = await supabase.from('movies').insert(toInsertPayload(newMovie));
      if (insertError) throw insertError;
      setNewMovie(EMPTY_FORM);
      await loadData();
    } catch (err: any) {
      console.error('Error creating movie:', err);
      setError(err?.message || 'Failed to create movie.');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (movie: Movie) => {
    setEditingId(movie.id);
    setEditForm({
      title: movie.title,
      activity_type_id: movie.activity_type_id ? String(movie.activity_type_id) : '',
      is_available: movie.is_available,
      notes: movie.notes ?? '',
    });
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    if (!editForm.title.trim() || !editForm.activity_type_id) {
      setError('Title and activity are required.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('movies')
        .update(toInsertPayload(editForm))
        .eq('id', editingId);
      if (updateError) throw updateError;
      cancelEdit();
      await loadData();
    } catch (err: any) {
      console.error('Error updating movie:', err);
      setError(err?.message || 'Failed to update movie.');
    } finally {
      setSaving(false);
    }
  };

  // The main lever for "this screening got pulled" — a one-click toggle
  // rather than routing through the edit form, since it's the thing this
  // page exists to make fast. Soft-disable only: a movie already referenced
  // by a booking/group (FK) can't be deleted, but it can always be flipped
  // unavailable so it stops being offered going forward.
  const handleToggleAvailable = async (movie: Movie) => {
    setTogglingId(movie.id);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('movies')
        .update({ is_available: !movie.is_available })
        .eq('id', movie.id);
      if (updateError) throw updateError;
      await loadData();
    } catch (err: any) {
      console.error('Error toggling movie availability:', err);
      setError(err?.message || 'Failed to update availability.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (movie: Movie) => {
    if (!window.confirm(`Delete "${movie.title}"? This can't be undone.`)) return;

    setDeletingId(movie.id);
    setError('');
    try {
      const { error: deleteError } = await supabase.from('movies').delete().eq('id', movie.id);
      if (deleteError) throw deleteError;
      await loadData();
    } catch (err: any) {
      console.error('Error deleting movie:', err);
      setError(
        err?.message?.includes('foreign key')
          ? `Can't delete "${movie.title}" — a booking or group already references it. Mark it unavailable instead.`
          : err?.message || 'Failed to delete movie.'
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
            <h1 className="text-2xl font-bold">Movies</h1>
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

        {/* Add Movie */}
        <div className="bg-white rounded-lg border p-6 mb-8">
          <h2 className="text-lg font-bold mb-4">Add a movie</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Movie title"
              value={newMovie.title}
              onChange={(e) => setNewMovie({ ...newMovie, title: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={newMovie.activity_type_id}
              onChange={(e) => setNewMovie({ ...newMovie, activity_type_id: e.target.value })}
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
              placeholder="Notes (genre, language, showtime…)"
              value={newMovie.notes}
              onChange={(e) => setNewMovie({ ...newMovie, notes: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm md:col-span-2"
            />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={newMovie.is_available}
                onChange={(e) => setNewMovie({ ...newMovie, is_available: e.target.checked })}
              />
              Currently showing (visible to students)
            </label>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="mt-4 px-6 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold disabled:bg-gray-300"
          >
            {creating ? 'Adding…' : 'Add Movie'}
          </button>
        </div>

        {/* Movie List */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-bold mb-4">All movies</h2>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
          ) : movies.length === 0 ? (
            <p className="text-gray-500 text-sm">No movies yet — add one above.</p>
          ) : (
            <div className="space-y-4">
              {movies.map((movie) =>
                editingId === movie.id ? (
                  <div key={movie.id} className="border rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
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
                        placeholder="Notes (genre, language, showtime…)"
                        value={editForm.notes}
                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                        className="border rounded-lg px-3 py-2 text-sm md:col-span-2"
                      />
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={editForm.is_available}
                          onChange={(e) => setEditForm({ ...editForm, is_available: e.target.checked })}
                        />
                        Currently showing (visible to students)
                      </label>
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
                  <div key={movie.id} className="border rounded-lg p-4 flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {movie.activity_types?.emoji} {movie.title}{' '}
                        {!movie.is_available && (
                          <span className="ml-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                            Unavailable
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-gray-600">
                        {movie.activity_types?.name ?? 'No activity set'}
                      </p>
                      {movie.notes && <p className="text-sm text-gray-500 mt-1">{movie.notes}</p>}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleToggleAvailable(movie)}
                        disabled={togglingId === movie.id}
                        className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                      >
                        {togglingId === movie.id
                          ? 'Updating…'
                          : movie.is_available
                            ? 'Mark unavailable'
                            : 'Mark available'}
                      </button>
                      <button
                        onClick={() => startEdit(movie)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(movie)}
                        disabled={deletingId === movie.id}
                        className="text-sm text-red-600 hover:text-red-800 disabled:text-gray-400"
                      >
                        {deletingId === movie.id ? 'Deleting…' : 'Delete'}
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
