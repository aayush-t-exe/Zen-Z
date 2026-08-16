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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Campus Social</h1>
          <p className="text-gray-600">Founder Dashboard</p>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleSendCode} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 text-white py-2 px-4 rounded-lg font-semibold hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send the code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter the 6-digit code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                required
                className="w-full px-4 py-2 text-center tracking-widest text-2xl border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
              <p className="text-sm text-gray-600 mt-2">
                Check {email} for the code
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full bg-gray-900 text-white py-2 px-4 rounded-lg font-semibold hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify code'}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('email');
                setCode('');
                setError('');
              }}
              className="w-full text-gray-600 hover:text-gray-900 font-medium"
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
