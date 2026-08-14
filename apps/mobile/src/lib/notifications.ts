import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

// Foreground notifications still show a banner/sound — without this handler
// they're delivered silently while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Registering a push token requires an EAS project id, which this app
// doesn't have linked yet (see docs/MILESTONES.md Milestone 16) — until
// `eas init` is run and app.json's extra.eas.projectId is set, this no-ops
// with a warning instead of throwing, so the rest of the app is unaffected.
export async function registerForPushNotificationsAsync(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn('[notifications] No EAS project id configured — skipping push registration.');
    return;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[notifications] Permission not granted — skipping push registration.');
    return;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

  const { error } = await supabase.from('profiles').update({ push_token: token }).eq('id', userId);
  if (error) {
    console.error('[notifications] Failed to save push token:', error);
  }
}

// Routes a tap on a delivered notification to the relevant screen, based on
// the `type`/`data` fields the send-notifications Edge Function sets
// (0019_notifications.sql, 0020_no_show_strikes.sql). Falls back to the
// Bookings tab for any type that doesn't have a dedicated screen yet (e.g.
// post_event_feedback — there's no feedback-entry screen built yet).
export function handleNotificationResponse(response: Notifications.NotificationResponse): void {
  const data = response.notification.request.content.data as Record<string, unknown>;

  if (data?.type === 'no_show' && typeof data?.bookingId === 'string') {
    router.push({ pathname: '/(home)/no-show', params: { bookingId: data.bookingId } });
    return;
  }

  if (typeof data?.groupId === 'string') {
    router.push({ pathname: '/(home)/group/[groupId]', params: { groupId: data.groupId } });
    return;
  }

  router.push('/(home)/bookings');
}

export function addNotificationResponseListener() {
  return Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
}
