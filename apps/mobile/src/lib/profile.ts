import { supabase } from '@/lib/supabase';

export interface ProfileFields {
  full_name: string | null;
  year_of_study: number | null;
  gender: string | null;
  phone: string | null;
  photo_url: string | null;
}

export async function fetchProfileFields(userId: string): Promise<ProfileFields> {
  const { data, error } = await supabase
    .from('profiles')
    .select('photo_url, full_name, year_of_study, gender, phone')
    .eq('id', userId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to load profile');
  }

  return data;
}

// profile-photos is a private bucket, so every read needs a signed URL —
// and createSignedUrl mints a brand new token on every call, even for the
// same file. Callers key this query by photoPath (not by screen focus or
// time) and set a staleTime close to the 3600s expiry below, so the URL —
// and the <Image> uri it feeds — only changes when the photo itself
// changes, not on every screen focus. That's what stops the photo from
// visibly re-downloading/flashing every time this tab regains focus.
export async function fetchSignedPhotoUrl(photoPath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('profile-photos')
    .createSignedUrl(photoPath, 3600);

  if (error) {
    throw error;
  }

  return data?.signedUrl ?? null;
}

export const profileFieldsKey = (userId: string) => ['profile', userId] as const;
export const profilePhotoKey = (photoPath: string) => ['profilePhoto', photoPath] as const;
