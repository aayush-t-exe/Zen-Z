'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export type AdminGuardStatus = 'checking' | 'authorized' | 'denied';

// Every admin page needs the same two checks — signed in, and present in
// admin_users — before it's safe to render or fetch anything. RLS is the
// real enforcement backstop, but without this a logged-in non-admin sees
// a silently broken page (empty lists, failed queries) instead of a clear
// "you don't have access" state.
export function useAdminGuard() {
  const router = useRouter();
  const [status, setStatus] = useState<AdminGuardStatus>('checking');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const { data: adminCheck } = await supabase
        .from('admin_users')
        .select('id')
        .eq('id', user.id)
        .single();

      if (cancelled) return;

      if (!adminCheck) {
        setStatus('denied');
        return;
      }

      setUserId(user.id);
      setStatus('authorized');
    };

    check();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return { status, userId };
}

export function AdminAccessDenied() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-canvas">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-ink mb-4">Access Denied</h1>
        <p className="text-ink-muted">You don&apos;t have permission to access this page.</p>
      </div>
    </div>
  );
}

export function AdminAuthLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-canvas">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ink"></div>
    </div>
  );
}
