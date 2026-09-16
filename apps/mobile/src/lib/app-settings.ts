import { supabase } from '@/lib/supabase';

// Generic reader for the app_settings key/value table (0034) — shared by
// emergency.ts and support.ts rather than each keeping its own copy.
export async function fetchAppSetting(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    console.error(`Failed to fetch app setting "${key}":`, error);
    return null;
  }

  return data?.value ?? null;
}
