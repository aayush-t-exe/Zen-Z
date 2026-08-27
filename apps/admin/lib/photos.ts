import { supabase } from '@/lib/supabase';

// profiles.photo_url is self-updatable by the student (0051_profiles_
// column_grants.sql) and only ever meant to be a boolean "has a photo" —
// the actual storage path is never trusted from that column's string
// value. A student could otherwise set photo_url to another student's real
// path ("<other_id>/profile.jpg") and have that student's real photo
// displayed under their own name across the admin dashboard. Every upload
// path (apps/mobile/.../profile-creation.tsx) writes to "<user_id>/
// profile.jpg", so that's the only path we ever ask the bucket to sign.
export async function getSignedPhotoUrl(
  studentId: string,
  hasPhoto: boolean,
  expiresInSeconds = 86400
): Promise<string | null> {
  if (!hasPhoto) return null;

  const { data, error } = await supabase.storage
    .from('profile-photos')
    .createSignedUrl(`${studentId}/profile.jpg`, expiresInSeconds);

  if (error) {
    console.error('Failed to sign photo URL:', error);
    return null;
  }

  return data.signedUrl;
}

// Returns a map keyed by student id (not by any client-supplied path).
export async function getSignedPhotoUrls(
  students: { id: string; hasPhoto: boolean }[],
  expiresInSeconds = 86400
): Promise<Record<string, string>> {
  const idsWithPhotos = Array.from(
    new Set(students.filter((s) => s.hasPhoto).map((s) => s.id))
  );
  if (idsWithPhotos.length === 0) return {};

  const paths = idsWithPhotos.map((id) => `${id}/profile.jpg`);
  const { data, error } = await supabase.storage
    .from('profile-photos')
    .createSignedUrls(paths, expiresInSeconds);

  if (error || !data) {
    console.error('Failed to sign photo URLs:', error);
    return {};
  }

  const map: Record<string, string> = {};
  data.forEach((item) => {
    if (item.path && item.signedUrl) {
      const studentId = item.path.split('/')[0];
      map[studentId] = item.signedUrl;
    }
  });
  return map;
}
