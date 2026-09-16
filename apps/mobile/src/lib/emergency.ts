import { fetchAppSetting } from '@/lib/app-settings';

export function fetchEmergencyContactPhone(): Promise<string | null> {
  return fetchAppSetting('emergency_contact_phone');
}

export function fetchEmergencyContactPhoneBackup(): Promise<string | null> {
  return fetchAppSetting('emergency_contact_phone_backup');
}
