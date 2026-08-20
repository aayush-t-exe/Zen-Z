import { supabase } from '@/lib/supabase';

async function fetchAppSetting(key: string): Promise<string | null> {
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

export function fetchEmergencyContactPhone(): Promise<string | null> {
  return fetchAppSetting('emergency_contact_phone');
}

export function fetchEmergencyContactPhoneBackup(): Promise<string | null> {
  return fetchAppSetting('emergency_contact_phone_backup');
}
