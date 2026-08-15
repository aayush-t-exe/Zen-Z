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

export interface TicketOutcome {
  status: 'sent' | 'failed';
  error: string | null;
}

export function resolveTicketOutcome(
  response: { ok: boolean; status: number },
  ticket: { status?: string; message?: string } | undefined
): TicketOutcome {
  const ok = response.ok && ticket?.status === 'ok';
  return {
    status: ok ? 'sent' : 'failed',
    error: ok ? null : ticket?.message || `HTTP ${response.status}`,
  };
}
