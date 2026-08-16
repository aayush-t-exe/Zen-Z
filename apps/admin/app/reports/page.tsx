'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminGuard, AdminAccessDenied, AdminAuthLoading } from '@/lib/adminAuth';
import { getSignedPhotoUrls } from '@/lib/photos';
import { formatSlotDateTime, initials } from '@/lib/format';
import Link from 'next/link';

interface ReportPerson {
  id: string;
  full_name: string;
  photo_url: string | null;
}

interface Report {
  id: string;
  reason: string | null;
  status: 'open' | 'resolved' | 'dismissed';
  created_at: string;
  reporter: ReportPerson | null;
  reported: ReportPerson | null;
  group: {
    activity_name: string;
    slot_datetime: string;
  } | null;
}

export default function ReportsPage() {
  const { status } = useAdminGuard();
  const [reports, setReports] = useState<Report[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingOnId, setActingOnId] = useState<string | null>(null);

  const loadReports = async () => {
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('reports')
      .select(
        `id, reason, status, created_at,
         reporter:reporter_id ( id, full_name, photo_url ),
         reported:reported_user_id ( id, full_name, photo_url ),
         groups:group_id (
           slots:slot_id ( slot_datetime, activity_types:activity_type_id ( name ) )
         )`
      )
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error loading reports:', fetchError);
      setError('Failed to load reports');
      setLoading(false);
      return;
    }

    const mapped: Report[] = (data ?? []).map((r: any) => ({
      id: r.id,
      reason: r.reason,
      status: r.status,
      created_at: r.created_at,
      reporter: r.reporter,
      reported: r.reported,
      group: r.groups?.slots
        ? {
            activity_name: r.groups.slots.activity_types?.name ?? 'Activity',
            slot_datetime: r.groups.slots.slot_datetime,
          }
        : null,
    }));

    setReports(mapped);

    const paths = mapped.flatMap((r) => [r.reporter?.photo_url, r.reported?.photo_url]);
    getSignedPhotoUrls(paths).then(setPhotoUrls);

    setLoading(false);
  };

  useEffect(() => {
    if (status !== 'authorized') return;
    loadReports();
  }, [status]);

  const setReportStatus = async (id: string, newStatus: 'resolved' | 'dismissed') => {
    setActingOnId(id);
    const { error: updateError } = await supabase
      .from('reports')
      .update({ status: newStatus })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating report:', updateError);
      setError('Failed to update that report');
    } else {
      setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
    }
    setActingOnId(null);
  };

  if (status === 'checking') {
    return <AdminAuthLoading />;
  }

  if (status === 'denied') {
    return <AdminAccessDenied />;
  }

  const openReports = reports.filter((r) => r.status === 'open');
  const closedReports = reports.filter((r) => r.status !== 'open');

  const photoFor = (person: ReportPerson | null) =>
    person?.photo_url ? photoUrls[person.photo_url] : undefined;

  const PersonBadge = ({ person, label }: { person: ReportPerson | null; label: string }) => (
    <div className="flex items-center gap-2">
      {photoFor(person) ? (
        <img
          src={photoFor(person)}
          alt={person?.full_name}
          className="w-8 h-8 rounded-lg object-cover bg-gray-200"
        />
      ) : (
        <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center text-[10px] font-semibold text-gray-600">
          {initials(person?.full_name)}
        </div>
      )}
      <div>
        <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-900">{person?.full_name ?? 'Unknown'}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-blue-600 hover:text-blue-800">
              Dashboard
            </Link>
            <h1 className="text-2xl font-bold">Reports</h1>
          </div>
          <Link href="/analytics" className="text-sm text-blue-600 hover:text-blue-800">
            Analytics
          </Link>
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
        ) : (
          <>
            <section className="mb-10">
              <h2 className="text-lg font-semibold mb-1">Open ({openReports.length})</h2>
              <p className="text-sm text-gray-500 mb-4">
                Reported students aren&apos;t paused automatically — they&apos;re flagged with a warning badge
                in the matching queue so you can watch for a pattern before acting.
              </p>
              {openReports.length === 0 ? (
                <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
                  No open reports.
                </div>
              ) : (
                <div className="space-y-4">
                  {openReports.map((report) => (
                    <div key={report.id} className="bg-white rounded-lg border p-5">
                      <div className="flex flex-wrap items-center gap-6 mb-3">
                        <PersonBadge person={report.reporter} label="Reported by" />
                        <PersonBadge person={report.reported} label="Reported" />
                      </div>
                      <p className="text-sm text-gray-800 mb-2">{report.reason || 'No reason given'}</p>
                      <p className="text-xs text-gray-500 mb-4">
                        {report.group &&
                          `${report.group.activity_name} · ${formatSlotDateTime(report.group.slot_datetime)} · `}
                        Filed {new Date(report.created_at).toLocaleString('en-IN')}
                      </p>
                      <div className="flex gap-2">
                        <button
                          disabled={actingOnId === report.id}
                          onClick={() => setReportStatus(report.id, 'resolved')}
                          className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50"
                        >
                          Mark resolved
                        </button>
                        <button
                          disabled={actingOnId === report.id}
                          onClick={() => setReportStatus(report.id, 'dismissed')}
                          className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium disabled:opacity-50 hover:bg-gray-50"
                        >
                          Dismiss
                        </button>
                        <a
                          href={`/student/${report.reported?.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50"
                        >
                          View reported student
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-4">History ({closedReports.length})</h2>
              {closedReports.length === 0 ? (
                <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
                  Nothing resolved or dismissed yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {closedReports.map((report) => (
                    <div key={report.id} className="bg-white rounded-lg border p-4 flex items-center justify-between">
                      <div className="flex flex-wrap items-center gap-6">
                        <PersonBadge person={report.reporter} label="Reported by" />
                        <PersonBadge person={report.reported} label="Reported" />
                        <p className="text-sm text-gray-600">{report.reason || 'No reason given'}</p>
                      </div>
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${
                          report.status === 'resolved'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {report.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
