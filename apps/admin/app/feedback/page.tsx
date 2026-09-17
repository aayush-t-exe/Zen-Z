'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAdminGuard, AdminAccessDenied, AdminAuthLoading } from '@/lib/adminAuth';
import { formatSlotDateTime } from '@/lib/format';

interface FeedbackRow {
  id: string;
  rating: number | null;
  would_repeat: 'yes' | 'maybe' | 'no' | null;
  private_note: string | null;
  media_path: string | null;
  media_consent: boolean;
  created_at: string;
  student: { full_name: string } | null;
  activity_name: string | null;
  slot_datetime: string | null;
}

export default function FeedbackPage() {
  const { status } = useAdminGuard();
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status !== 'authorized') return;

    const load = async () => {
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('feedback')
        .select(
          `id, rating, would_repeat, private_note, media_path, media_consent, created_at,
           bookings:booking_id (
             profiles:user_id ( full_name ),
             slots:slot_id ( slot_datetime, activity_types:activity_type_id ( name ) )
           )`
        )
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error loading feedback:', fetchError);
        setError('Failed to load feedback');
        setLoading(false);
        return;
      }

      const mapped: FeedbackRow[] = (data ?? []).map((r: any) => ({
        id: r.id,
        rating: r.rating,
        would_repeat: r.would_repeat,
        private_note: r.private_note,
        media_path: r.media_path,
        media_consent: r.media_consent,
        created_at: r.created_at,
        student: r.bookings?.profiles ?? null,
        activity_name: r.bookings?.slots?.activity_types?.name ?? null,
        slot_datetime: r.bookings?.slots?.slot_datetime ?? null,
      }));

      setRows(mapped);
      setLoading(false);

      const withMedia = mapped.filter((r) => r.media_path && r.media_consent);
      if (withMedia.length > 0) {
        const { data: signed, error: signError } = await supabase.storage
          .from('event-highlights')
          .createSignedUrls(withMedia.map((r) => r.media_path!), 3600);

        if (!signError && signed) {
          const map: Record<string, string> = {};
          signed.forEach((s, i) => {
            if (s.signedUrl) map[withMedia[i].id] = s.signedUrl;
          });
          setMediaUrls(map);
        }
      }
    };

    load();
  }, [status]);

  if (status === 'checking') return <AdminAuthLoading />;
  if (status === 'denied') return <AdminAccessDenied />;

  const withMediaCount = rows.filter((r) => r.media_path && r.media_consent).length;
  const avgRating =
    rows.filter((r) => r.rating).reduce((sum, r) => sum + (r.rating ?? 0), 0) /
    (rows.filter((r) => r.rating).length || 1);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-blue-600 hover:text-blue-800">
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-bold">Feedback</h1>
          </div>
          <p className="text-sm text-gray-500">
            {rows.length} responses · avg {avgRating.toFixed(1)}★ · {withMediaCount} with media
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
            No feedback submitted yet.
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((r) => (
              <div key={r.id} className="bg-white rounded-lg border p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {r.student?.full_name ?? 'Unknown student'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {r.activity_name && r.slot_datetime
                        ? `${r.activity_name} · ${formatSlotDateTime(r.slot_datetime)}`
                        : null}
                      {' · '}
                      {new Date(r.created_at).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {r.rating !== null && (
                      <span className="text-sm font-medium text-gray-900">
                        {'★'.repeat(r.rating)}
                        {'☆'.repeat(5 - r.rating)}
                      </span>
                    )}
                    {r.would_repeat && (
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          r.would_repeat === 'yes'
                            ? 'bg-green-100 text-green-700'
                            : r.would_repeat === 'no'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {r.would_repeat === 'yes'
                          ? 'Would repeat'
                          : r.would_repeat === 'no'
                            ? 'Would not repeat'
                            : 'Maybe'}
                      </span>
                    )}
                  </div>
                </div>

                {r.private_note && (
                  <p className="text-sm text-gray-700 mb-3">&ldquo;{r.private_note}&rdquo;</p>
                )}

                {r.media_path && r.media_consent && (
                  mediaUrls[r.id] ? (
                    r.media_path.endsWith('.mp4') ? (
                      <video
                        src={mediaUrls[r.id]}
                        controls
                        className="w-full max-w-sm rounded-lg bg-gray-100"
                      />
                    ) : (
                      <img
                        src={mediaUrls[r.id]}
                        alt="Submitted event highlight"
                        className="w-full max-w-sm rounded-lg object-cover bg-gray-100"
                      />
                    )
                  ) : (
                    <p className="text-xs text-gray-400">Loading media…</p>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
