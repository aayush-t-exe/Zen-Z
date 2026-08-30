// Pure logic extracted from index.ts so it's testable under Node/Vitest
// without a Deno runtime — no Deno.*/deno.land imports here.

export interface OutboxRow {
  id: string;
  profiles?: { push_token?: string | null } | null;
  [key: string]: unknown;
}

export function partitionByPushToken<T extends OutboxRow>(rows: T[]): { withToken: T[]; withoutToken: T[] } {
  return {
    withToken: rows.filter((r) => !!r.profiles?.push_token),
    withoutToken: rows.filter((r) => !r.profiles?.push_token),
  };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

export function buildExpoMessages(
  batch: { title: string; body: string; type: string; data?: Record<string, unknown> | null; profiles?: { push_token?: string | null } | null }[]
): ExpoMessage[] {
  return batch.map((r) => ({
    to: r.profiles?.push_token as string,
    title: r.title,
    body: r.body,
    data: { ...(r.data ?? {}), type: r.type },
  }));
}

// Platform verify_jwt accepts any validly-signed Supabase JWT, including
// the public anon key — so this function has to check for itself that the
// caller is specifically the pg_cron job (0019_notifications.sql), which
// sends the service-role key as its bearer token.
export function isAuthorizedCronCaller(authHeader: string | null, serviceRoleKey: string): boolean {
  return authHeader === `Bearer ${serviceRoleKey}`;
}

// A transient failure (network blip, Expo 5xx, rate limiting) gets this
// many total send attempts (the original plus retries) before it's given
// up on and marked permanently 'failed' — bounded so a persistently broken
// row can't loop through the queue forever.
export const MAX_ATTEMPTS = 3;

export interface TicketOutcome {
  // 'pending' means "requeue for another attempt" — the row goes back
  // through claim_pending_notifications on a later cron tick.
  status: 'sent' | 'pending' | 'failed';
  error: string | null;
  // True only for a permanent, un-retryable failure (Expo's
  // DeviceNotRegistered) — the token is dead, not just slow to answer, so
  // it's cleared from profiles.push_token rather than retried. The app
  // re-registers a fresh one on every launch (_layout.tsx), so this
  // self-heals instead of silently failing forever.
  clearPushToken: boolean;
}

export function resolveTicketOutcome(
  response: { ok: boolean; status: number },
  ticket: { status?: string; message?: string; details?: { error?: string } } | undefined,
  attemptCount: number
): TicketOutcome {
  const ok = response.ok && ticket?.status === 'ok';
  if (ok) {
    return { status: 'sent', error: null, clearPushToken: false };
  }

  if (ticket?.details?.error === 'DeviceNotRegistered') {
    return { status: 'failed', error: 'DeviceNotRegistered', clearPushToken: true };
  }

  const error = ticket?.message || `HTTP ${response.status}`;
  const status = attemptCount < MAX_ATTEMPTS ? 'pending' : 'failed';
  return { status, error, clearPushToken: false };
}
