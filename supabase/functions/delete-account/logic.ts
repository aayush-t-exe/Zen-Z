// Pure logic extracted from index.ts so it's testable under Node/Vitest
// without a Deno runtime — no Deno.*/deno.land imports here.

// The request body's userId (admin path) is only ever a *target*, never
// an identity claim — the caller's own JWT is what index.ts trusts for
// who's asking. Whether that target is actually reachable is enforced by
// which RPC gets called next (delete_own_account always targets the
// caller regardless of what's passed here; admin_delete_account
// re-checks admin_users itself), not by anything in this function.
export function resolveTargetUserId(callerId: string, requestedUserId?: string | null): string {
  return requestedUserId && requestedUserId.trim() ? requestedUserId : callerId;
}

export function isAdminDeletion(callerId: string, targetUserId: string): boolean {
  return targetUserId !== callerId;
}

// Matches the fixed upload path profile-creation.tsx writes to
// (`${currentUser.id}/profile.jpg`) — deterministic, so no DB lookup is
// needed to find what to remove.
export function photoStoragePath(userId: string): string {
  return `${userId}/profile.jpg`;
}
