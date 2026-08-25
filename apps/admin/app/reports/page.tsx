'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminGuard, AdminAccessDenied, AdminAuthLoading } from '@/lib/adminAuth';
import { getSignedPhotoUrls } from '@/lib/photos';
import { formatSlotDateTime } from '@/lib/format';
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
  message_id: string | null;
  reporter: ReportPerson | null;
  reported: ReportPerson | null;
  group: {
    activity_name: string;
    activity_emoji: string;
    slot_datetime: string;
  } | null;
}

interface RevealedMessage {
  content: string | null;
  is_deleted: boolean;
  sender_id: string;
  created_at: string;
}

export default function ReportsPage() {
  const { status } = useAdminGuard();
  const [reports, setReports] = useState<Report[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingOnId, setActingOnId] = useState<string | null>(null);
  const [revealedMessages, setRevealedMessages] = useState<Record<string, RevealedMessage>>({});
  const [revealingId, setRevealingId] = useState<string | null>(null);

  const loadReports = async () => {
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('reports')
      .select(
        `id, reason, status, created_at, message_id,
         reporter:reporter_id ( id, full_name, photo_url ),
         reported:reported_user_id ( id, full_name, photo_url ),
         groups:group_id (
           slots:slot_id ( slot_datetime, activity_types:activity_type_id ( name, emoji ) )
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
      message_id: r.message_id,
      reporter: r.reporter,
      reported: r.reported,
      group: r.groups?.slots
        ? {
            activity_name: r.groups.slots.activity_types?.name ?? 'Activity',
            activity_emoji: r.groups.slots.activity_types?.emoji ?? '',
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

  // Message content is never included in the reports query above (see
  // docs/ARCHITECTURE.md "Chat privacy") — this is the one deliberate,
  // logged exception: each call inserts an audit row in
  // report_message_reveals via the RPC before returning content.
  const revealMessage = async (reportId: string) => {
    setRevealingId(reportId);
    const { data, error: revealError } = await supabase
      .rpc('reveal_reported_message', { p_report_id: reportId })
      .single();

    if (revealError) {
      console.error('Error revealing message:', revealError);
      setError('Failed to reveal that message');
    } else {
      setRevealedMessages((prev) => ({ ...prev, [reportId]: data as RevealedMessage }));
    }
    setRevealingId(null);
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
          className="w-8 h-8 rounded-lg object-cover bg-surface-selected"
        />
      ) : (
        <div className="w-8 h-8 rounded-lg bg-surface-selected flex items-center justify-center text-xs">
          📷
        </div>
      )}
      <div>
        <p className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</p>
        <p className="text-sm font-medium text-ink">{person?.full_name ?? 'Unknown'}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-surface border-b border-line sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-ink-muted hover:text-ink">
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-ink">Reports</h1>
          </div>
          <Link href="/analytics" className="text-sm text-ink-muted hover:text-ink">
            Analytics →
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-danger/10 border border-danger/30 text-danger px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ink"></div>
          </div>
        ) : (
          <>
            <section className="mb-10">
              <h2 className="text-lg font-semibold text-ink mb-1">Open ({openReports.length})</h2>
              <p className="text-sm text-ink-muted mb-4">
                Reported students aren&apos;t paused automatically — they&apos;re flagged with a warning badge
                in the matching queue so you can watch for a pattern before acting.
              </p>
              {openReports.length === 0 ? (
                <div className="bg-surface rounded-lg border border-line p-8 text-center text-ink-muted">
                  No open reports.
                </div>
              ) : (
                <div className="space-y-4">
                  {openReports.map((report) => (
                    <div key={report.id} className="bg-surface rounded-lg border border-line p-5">
                      <div className="flex flex-wrap items-center gap-6 mb-3">
                        <PersonBadge person={report.reporter} label="Reported by" />
                        <PersonBadge person={report.reported} label="Reported" />
                      </div>
                      <p className="text-sm text-ink mb-2">{report.reason || 'No reason given'}</p>
                      <p className="text-xs text-ink-muted mb-4">
                        {report.group &&
                          `${report.group.activity_emoji} ${report.group.activity_name} · ${formatSlotDateTime(report.group.slot_datetime)} · `}
                        Filed {new Date(report.created_at).toLocaleString('en-IN')}
                      </p>
                      {report.message_id && (
                        <div className="mb-4">
                          {revealedMessages[report.id] ? (
                            <div className="rounded-lg border border-warn/30 bg-warn/10 px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wide text-warn mb-1">
                                Flagged message · revealed, logged
                              </p>
                              <p className="text-sm text-ink">
                                {revealedMessages[report.id].is_deleted
                                  ? 'Message was deleted by the sender before review.'
                                  : revealedMessages[report.id].content}
                              </p>
                            </div>
                          ) : (
                            <button
                              disabled={revealingId === report.id}
                              onClick={() => revealMessage(report.id)}
                              className="px-3 py-1.5 rounded-lg border border-warn/30 bg-warn/10 text-warn text-xs font-medium disabled:opacity-50 hover:bg-warn/20"
                            >
                              {revealingId === report.id
                                ? 'Revealing…'
                                : '⚠ Reveal flagged message (logged)'}
                            </button>
                          )}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          disabled={actingOnId === report.id}
                          onClick={() => setReportStatus(report.id, 'resolved')}
                          className="px-4 py-2 rounded-lg bg-ink text-black text-sm font-medium disabled:opacity-50"
                        >
                          Mark resolved
                        </button>
                        <button
                          disabled={actingOnId === report.id}
                          onClick={() => setReportStatus(report.id, 'dismissed')}
                          className="px-4 py-2 rounded-lg border border-line text-ink text-sm font-medium disabled:opacity-50 hover:bg-surface-selected"
                        >
                          Dismiss
                        </button>
                        <a
                          href={`/student/${report.reported?.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 rounded-lg border border-line text-ink text-sm font-medium hover:bg-surface-selected"
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
              <h2 className="text-lg font-semibold text-ink mb-4">History ({closedReports.length})</h2>
              {closedReports.length === 0 ? (
                <div className="bg-surface rounded-lg border border-line p-8 text-center text-ink-muted">
                  Nothing resolved or dismissed yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {closedReports.map((report) => (
                    <div key={report.id} className="bg-surface rounded-lg border border-line p-4 flex items-center justify-between">
                      <div className="flex flex-wrap items-center gap-6">
                        <PersonBadge person={report.reporter} label="Reported by" />
                        <PersonBadge person={report.reported} label="Reported" />
                        <p className="text-sm text-ink-muted">{report.reason || 'No reason given'}</p>
                      </div>
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${
                          report.status === 'resolved'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-surface-selected text-ink-muted'
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
