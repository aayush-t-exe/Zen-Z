import { supabase } from '@/lib/supabase';

// profiles.photo_url stores the storage path ("{user_id}/profile.jpg"),
// not a usable URL — the profile-photos bucket is private, so every
// admin view has to exchange that path for a time-limited signed URL
// per docs/STORAGE.md. Rendering photo_url directly as an <img src>
// (what this used to do) just fails silently: it's a bare path, not
// a fetchable address.
export async function getSignedPhotoUrl(
  path: string | null,
  expiresInSeconds = 86400
): Promise<string | null> {
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from('profile-photos')
    .createSignedUrl(path, expiresInSeconds);

  if (error) {
    console.error('Failed to sign photo URL:', error);
    return null;
  }

  return data.signedUrl;
}

export async function getSignedPhotoUrls(
  paths: (string | null | undefined)[],
  expiresInSeconds = 86400
): Promise<Record<string, string>> {
  const uniquePaths = Array.from(new Set(paths.filter((p): p is string => !!p)));
  if (uniquePaths.length === 0) return {};

  const { data, error } = await supabase.storage
    .from('profile-photos')
    .createSignedUrls(uniquePaths, expiresInSeconds);

  if (error || !data) {
    console.error('Failed to sign photo URLs:', error);
    return {};
  }

  const map: Record<string, string> = {};
  data.forEach((item) => {
    if (item.path && item.signedUrl) {
      map[item.path] = item.signedUrl;
    }
  });
  return map;
}
