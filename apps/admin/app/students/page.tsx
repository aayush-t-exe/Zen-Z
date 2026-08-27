'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAdminGuard, AdminAccessDenied, AdminAuthLoading } from '@/lib/adminAuth';
import { getSignedPhotoUrls } from '@/lib/photos';

interface StudentRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  gender: string | null;
  year_of_study: number | null;
  photo_path: string | null;
  created_at: string;
}

export default function StudentsPage() {
  const { status } = useAdminGuard();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status !== 'authorized') return;

    const load = async () => {
      setLoading(true);
      setError('');

      // admin_student_profiles (0004_storage_helpers.sql) — every student,
      // independent of whether they've ever booked anything, unlike the
      // matching/groups pages which only ever surface students who show up
      // in a booking. photo_path (not photo_url) so the actual signed-URL
      // request below always derives the storage path from the student's
      // own id, never the client-writable profiles.photo_url column.
      const { data, error: fetchError } = await supabase
        .from('admin_student_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Failed to load students:', fetchError);
        setError('Failed to load students');
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as StudentRow[];
      setStudents(rows);

      const urls = await getSignedPhotoUrls(
        rows.map((s) => ({ id: s.id, hasPhoto: !!s.photo_path }))
      );
      setPhotoUrls(urls);

      setLoading(false);
    };

    load();
  }, [status]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.phone ?? '').toLowerCase().includes(q)
    );
  }, [students, query]);

  if (status === 'checking' || (status === 'authorized' && loading)) {
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
            <h1 className="text-2xl font-bold">Students</h1>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, or phone"
            className="w-72 rounded-lg border px-3 py-2 text-sm"
          />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <p className="text-sm text-gray-500 mb-4">
          {filtered.length.toLocaleString('en-IN')} of {students.length.toLocaleString('en-IN')} student
          {students.length === 1 ? '' : 's'} — every signed-up profile, whether or not they&apos;ve booked yet.
        </p>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
            {students.length === 0 ? 'No students yet.' : 'No students match that search.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((s) => (
              <Link
                key={s.id}
                href={`/student/${s.id}`}
                className="bg-white rounded-lg border p-4 flex gap-4 items-center hover:border-gray-400 transition-colors"
              >
                {photoUrls[s.id] ? (
                  <img
                    src={photoUrls[s.id]}
                    alt={s.full_name}
                    className="w-16 h-16 rounded-lg object-cover bg-gray-200 shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center text-2xl shrink-0">
                    📷
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{s.full_name}</p>
                  <p className="text-sm text-gray-600">
                    {s.gender ? s.gender.charAt(0).toUpperCase() : '—'}
                    {s.year_of_study ? ` · ${s.year_of_study}${getYearSuffix(s.year_of_study)} year` : ''}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{s.email}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function getYearSuffix(year: number): string {
  if (year === 1) return 'st';
  if (year === 2) return 'nd';
  if (year === 3) return 'rd';
  return 'th';
}
