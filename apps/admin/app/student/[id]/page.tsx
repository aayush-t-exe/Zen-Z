'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAdminGuard, AdminAccessDenied, AdminAuthLoading } from '@/lib/adminAuth';
import { getSignedPhotoUrl } from '@/lib/photos';
import Link from 'next/link';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  gender: string | null;
  year_of_study: number;
  phone: string | null;
  photo_url: string | null;
}

interface PersonalityDimension {
  id: number;
  key: string;
  label: string;
}

interface PersonalityScore {
  dimension_id: number;
  score: number;
}

interface PersonalityAnswer {
  question_id: number;
  question: {
    prompt: string;
    question_type: string;
  };
  selected_option_ids: number[] | null;
  scale_value: number | null;
}

export default function StudentProfilePage() {
  const { status } = useAdminGuard();
  const params = useParams();
  const studentId = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<PersonalityDimension[]>([]);
  const [scores, setScores] = useState<PersonalityScore[]>([]);
  const [answers, setAnswers] = useState<PersonalityAnswer[]>([]);
  const [optionLabels, setOptionLabels] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    if (status !== 'authorized') return;

    const fetchStudentProfile = async () => {
      try {
        setLoading(true);

        // Fetch profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', studentId)
          .single();

        // A fetch failure must not read as "Student not found" — this page
        // is where a founder investigating a report lands, and that
        // message implies the account doesn't exist rather than that the
        // query just failed.
        if (profileError) {
          setError(`Failed to load this student: ${profileError.message}`);
          return;
        }

        if (!profileData) {
          setError('Student not found');
          return;
        }

        setProfile(profileData);
        getSignedPhotoUrl(studentId, !!profileData.photo_url).then(setPhotoUrl);

        // Fetch dimensions
        const { data: dimensionsData } = await supabase
          .from('personality_dimensions')
          .select('*')
          .order('id', { ascending: true });

        if (dimensionsData) {
          setDimensions(dimensionsData);
        }

        // Fetch scores
        const { data: scoresData } = await supabase
          .from('personality_scores')
          .select('*')
          .eq('user_id', studentId);

        if (scoresData) {
          setScores(scoresData);
        }

        // Fetch answers
        const { data: answersData } = await supabase
          .from('personality_answers')
          .select(`
            question_id,
            selected_option_ids,
            scale_value,
            question:question_id (
              prompt,
              question_type
            )
          `)
          .eq('user_id', studentId);

        if (answersData) {
          setAnswers(answersData as any);
        }

        // selected_option_ids is a plain int[] column, not a foreign key —
        // PostgREST can't embed the option labels via the nested-select
        // above the way it does for `question:question_id`, so the actual
        // option text has to be resolved separately. The option set is
        // small (a few dozen across the whole quiz), so fetching all of it
        // once and looking answers up client-side is simpler than a
        // per-answer query.
        const { data: optionsData } = await supabase
          .from('personality_question_options')
          .select('id, label');

        if (optionsData) {
          const labelMap: Record<number, string> = {};
          optionsData.forEach((o: any) => {
            labelMap[o.id] = o.label;
          });
          setOptionLabels(labelMap);
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError('Failed to load student profile');
      } finally {
        setLoading(false);
      }
    };

    fetchStudentProfile();
  }, [status, studentId]);

  if (status === 'checking' || (status === 'authorized' && loading)) {
    return <AdminAuthLoading />;
  }

  if (status === 'denied') {
    return <AdminAccessDenied />;
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Not Found</h1>
          <p className="text-gray-600 mb-6">{error || 'Student profile could not be loaded'}</p>
          <Link href="/matching" className="text-blue-600 hover:text-blue-800">
            ← Back to matching
          </Link>
        </div>
      </div>
    );
  }

  if (deleted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Account deleted</h1>
          <p className="text-gray-600 mb-6">Their profile info is scrubbed and they can no longer sign in.</p>
          <Link href="/students" className="text-blue-600 hover:text-blue-800">
            ← Back to students
          </Link>
        </div>
      </div>
    );
  }

  const getScoreForDimension = (dimensionId: number): number => {
    const score = scores.find(s => s.dimension_id === dimensionId);
    return score ? score.score : 0;
  };

  const handleDeleteAccount = async () => {
    if (isDeleting) return;

    // Two separate, differently-worded confirms rather than one — this
    // scrubs the student's profile and permanently bans their login, so
    // it deserves more friction than the single window.confirm() this
    // app uses for reversible-in-spirit actions elsewhere (cancelling a
    // booking, deleting a venue).
    if (!window.confirm(`Delete ${profile!.full_name}'s account? This scrubs their profile info, removes their photo, and blocks them from ever signing back in.`)) {
      return;
    }
    if (!window.confirm('Are you absolutely sure? This cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    setDeleteError('');

    const { error: functionError } = await supabase.functions.invoke('delete-account', {
      body: { userId: studentId },
    });
    setIsDeleting(false);

    if (functionError) {
      // supabase-js only gives a generic "non-2xx status" message by
      // default — the actual reason is in the response body, on
      // FunctionsHttpError's `context` (the raw Response).
      let message = functionError.message || 'Failed to delete account';
      const context = (functionError as any).context;
      if (context && typeof context.json === 'function') {
        try {
          const body = await context.json();
          if (body?.error) message = body.error;
        } catch {
          // Body wasn't JSON — fall back to the generic message.
        }
      }

      if (message === 'ACTIVE_BOOKING') {
        setDeleteError("This student has a paid booking that's still pending or matched — cancel it first, then delete the account.");
        return;
      }
      setDeleteError(message);
      return;
    }

    setDeleted(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link href="/matching" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
            ← Back to matching
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Profile Header */}
        <div className="bg-white rounded-lg border p-8 mb-8">
          <div className="flex gap-6 items-start mb-6">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={profile.full_name}
                className="w-24 h-24 rounded-lg object-cover bg-gray-200"
              />
            ) : (
              <div className="w-24 h-24 rounded-lg bg-gray-200 flex items-center justify-center text-4xl">
                📷
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{profile.full_name}</h1>
              <p className="text-gray-600 mb-4">
                {profile.gender ? profile.gender.charAt(0).toUpperCase() : '—'} · {profile.year_of_study}{getYearSuffix(profile.year_of_study)} year
              </p>
              <div className="text-sm text-gray-600 space-y-1">
                <p>Email: {profile.email}</p>
                {profile.phone && <p>Phone: {profile.phone}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Personality Profile */}
        <div className="bg-white rounded-lg border p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6">Personality Profile</h2>

          {dimensions.length === 0 ? (
            <p className="text-gray-600">No personality dimensions available yet</p>
          ) : (
            <div className="space-y-6">
              {dimensions.map(dim => {
                const score = getScoreForDimension(dim.id);
                const percentage = Math.round(score * 100);

                return (
                  <div key={dim.id}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="font-medium text-gray-900">{dim.label}</label>
                      <span className="text-sm font-semibold text-gray-600">{percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gray-900 h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Raw Answers */}
        <div className="bg-white rounded-lg border p-8">
          <h2 className="text-2xl font-bold mb-6">Quiz Responses</h2>

          {answers.length === 0 ? (
            <p className="text-gray-600">No responses yet</p>
          ) : (
            <div className="space-y-6">
              {answers.map(answer => (
                <div key={answer.question_id} className="pb-6 border-b last:border-b-0">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {answer.question.prompt}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {answer.scale_value !== null
                      ? `Selected: ${answer.scale_value}`
                      : answer.selected_option_ids && answer.selected_option_ids.length > 0
                      ? answer.selected_option_ids
                          .map((id) => optionLabels[id] ?? `Option #${id}`)
                          .join(', ')
                      : 'No response'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Danger zone */}
        <div className="bg-white rounded-lg border border-red-200 p-8 mt-8">
          <h2 className="text-lg font-bold text-red-700 mb-1">Danger zone</h2>
          <p className="text-sm text-gray-600 mb-4">
            Scrubs their profile info and photo, and permanently blocks them from signing back in.
            Booking/payment/report history is kept for audit. Refused if they have a paid booking
            still pending or matched.
          </p>
          {deleteError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {deleteError}
            </div>
          )}
          <button
            onClick={handleDeleteAccount}
            disabled={isDeleting}
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-red-700"
          >
            {isDeleting ? 'Deleting…' : 'Delete account'}
          </button>
        </div>
      </main>
    </div>
  );
}

function getYearSuffix(year: number): string {
  if (year === 1) return 'st';
  if (year === 2) return 'nd';
  if (year === 3) return 'rd';
  if (year === 4) return 'th';
  return 'th';
}
