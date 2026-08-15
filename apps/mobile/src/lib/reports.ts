import { supabase } from '@/lib/supabase';

// Fixed set of reasons rather than free-form-only input — quick to tap,
// and gives the founder a consistent signal to triage by in the admin
// reports queue. [ASSUMPTION] wording is a first draft in the
// established voice, not founder-reviewed word-for-word (same caveat as
// the no-show screen microcopy).
export const REPORT_REASONS = [
  'Made me uncomfortable',
  'Inappropriate or unsafe behavior',
  'Something else',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export async function submitReport(params: {
  reportedUserId: string;
  groupId: string;
  reason: string;
}): Promise<void> {
  const { error } = await supabase.from('reports').insert({
    reported_user_id: params.reportedUserId,
    group_id: params.groupId,
    reason: params.reason,
  });

  if (error) throw error;
}

// "self read own reports" (0021) scopes this to reports the current
// user filed, so a groupId filter is enough to know who they've already
// reported in this group.
export async function fetchMyReportedUserIds(groupId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('reported_user_id')
    .eq('group_id', groupId);

  if (error) {
    console.error('Failed to fetch existing reports:', error);
    return [];
  }

  return (data ?? []).map((r) => r.reported_user_id);
}
