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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status !== 'authorized') return;

    const fetchStudentProfile = async () => {
      try {
        setLoading(true);

        // Fetch profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', studentId)
          .single();

        if (!profileData) {
          setError('Student not found');
          return;
        }

        setProfile(profileData);
        getSignedPhotoUrl(profileData.photo_url).then(setPhotoUrl);

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
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-ink mb-4">Not Found</h1>
          <p className="text-ink-muted mb-6">{error || 'Student profile could not be loaded'}</p>
          <Link href="/matching" className="text-ink-muted hover:text-ink">
            ← Back to matching
          </Link>
        </div>
      </div>
    );
  }

  const getScoreForDimension = (dimensionId: number): number => {
    const score = scores.find(s => s.dimension_id === dimensionId);
    return score ? score.score : 0;
  };

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-surface border-b border-line">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link href="/matching" className="text-ink-muted hover:text-ink text-sm font-medium">
            ← Back to matching
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Profile Header */}
        <div className="bg-surface rounded-lg border border-line p-8 mb-8">
          <div className="flex gap-6 items-start mb-6">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={profile.full_name}
                className="w-24 h-24 rounded-lg object-cover bg-surface-selected"
              />
            ) : (
              <div className="w-24 h-24 rounded-lg bg-surface-selected flex items-center justify-center text-4xl">
                📷
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-ink mb-2">{profile.full_name}</h1>
              <p className="text-ink-muted mb-4">
                {profile.gender ? profile.gender.charAt(0).toUpperCase() : '—'} · {profile.year_of_study}{getYearSuffix(profile.year_of_study)} year
              </p>
              <div className="text-sm text-ink-muted space-y-1">
                <p>Email: {profile.email}</p>
                {profile.phone && <p>Phone: {profile.phone}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Personality Profile */}
        <div className="bg-surface rounded-lg border border-line p-8 mb-8">
          <h2 className="text-2xl font-bold text-ink mb-6">Personality Profile</h2>

          {dimensions.length === 0 ? (
            <p className="text-ink-muted">No personality dimensions available yet</p>
          ) : (
            <div className="space-y-6">
              {dimensions.map(dim => {
                const score = getScoreForDimension(dim.id);
                const percentage = Math.round(score * 100);

                return (
                  <div key={dim.id}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="font-medium text-ink">{dim.label}</label>
                      <span className="text-sm font-semibold text-ink-muted">{percentage}%</span>
                    </div>
                    <div className="w-full bg-surface-selected rounded-full h-2">
                      <div
                        className="bg-ink h-2 rounded-full transition-all"
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
        <div className="bg-surface rounded-lg border border-line p-8">
          <h2 className="text-2xl font-bold text-ink mb-6">Quiz Responses</h2>

          {answers.length === 0 ? (
            <p className="text-ink-muted">No responses yet</p>
          ) : (
            <div className="space-y-6">
              {answers.map(answer => (
                <div key={answer.question_id} className="pb-6 border-b border-line last:border-b-0">
                  <h3 className="font-semibold text-ink mb-2">
                    {answer.question.prompt}
                  </h3>
                  <p className="text-sm text-ink-muted">
                    {answer.scale_value !== null
                      ? `Selected: ${answer.scale_value}`
                      : answer.selected_option_ids
                      ? `Selected ${answer.selected_option_ids.length} option(s)`
                      : 'No response'}
                  </p>
                </div>
              ))}
            </div>
          )}
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
