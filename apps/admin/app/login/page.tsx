'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // admin_users is an allow-list with no public signup path — without
      // shouldCreateUser: false, any email typed here creates a real
      // auth.users + profiles row (via the signup trigger) before the OTP
      // is ever checked, even for someone who was never going to pass the
      // admin_users check.
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });

      if (error) {
        setError(error.message);
      } else {
        setStep('code');
      }
    } catch (err) {
      setError('Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email',
      });

      if (error) {
        setError(error.message);
      } else if (data.user) {
        // Check if user is admin
        const { data: adminCheck } = await supabase
          .from('admin_users')
          .select('id')
          .eq('id', data.user.id)
          .single();

        if (!adminCheck) {
          setError('You do not have admin access');
          await supabase.auth.signOut();
        } else {
          router.push('/');
        }
      }
    } catch (err) {
      setError('Failed to verify code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="bg-surface border border-line rounded-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-ink mb-2">Campus Social</h1>
          <p className="text-ink-muted">Founder Dashboard</p>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleSendCode} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-ink-muted mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-2 bg-canvas border border-line rounded-lg text-ink placeholder:text-ink-muted focus:ring-2 focus:ring-ink focus:border-transparent"
              />
            </div>

            {error && (
              <div className="bg-danger/10 border border-danger/30 text-danger px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ink text-black py-2 px-4 rounded-lg font-semibold hover:bg-ink-muted disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send the code →'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-ink-muted mb-2">
                Enter the 6-digit code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                required
                className="w-full px-4 py-2 text-center tracking-widest text-2xl bg-canvas border border-line rounded-lg text-ink placeholder:text-ink-muted focus:ring-2 focus:ring-ink focus:border-transparent"
              />
              <p className="text-sm text-ink-muted mt-2">
                Check {email} for the code
              </p>
            </div>

            {error && (
              <div className="bg-danger/10 border border-danger/30 text-danger px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full bg-ink text-black py-2 px-4 rounded-lg font-semibold hover:bg-ink-muted disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify code →'}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('email');
                setCode('');
                setError('');
              }}
              className="w-full text-ink-muted hover:text-ink font-medium"
            >
              ← Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
