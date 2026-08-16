// expo-notifications is loaded lazily, never at module scope.
//
// Importing it pulls in DevicePushTokenAutoRegistration.fx, whose top-level
// code calls warnOfExpoGoPushUsage(). On Android in Expo Go that function
// THROWS rather than warning, because remote push was removed from Expo Go
// in SDK 53. A module-scope import therefore took down every module that
// transitively depended on this one: (home)/_layout.tsx failed to evaluate,
// Expo Router reported "missing the required default export", and rendering
// died on "Cannot read property 'ErrorBoundary' of undefined". The app could
// not open at all.
//
// This is the one piece of today's work kept through the rollback of the
// visual system, because it is a crash fix rather than a design change and
// it predates that work. Deferring the require keeps the side effect out of
// the module graph, so Expo Go runs the app and simply has no push. A
// development build is still required to actually receive notifications.

import type * as ExpoNotifications from 'expo-notifications';
import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

type NotificationsModule = typeof ExpoNotifications;

/** Matches what expo-notifications itself checks before throwing. */
function pushIsUnavailable(): boolean {
  return Platform.OS === 'web' || isRunningInExpoGo();
}

let cached: NotificationsModule | null = null;

/**
 * Returns the native module, or null where push cannot work. Callers must
 * treat null as "carry on without notifications", never as an error.
 */
function loadNotifications(): NotificationsModule | null {
  if (pushIsUnavailable()) return null;

  if (!cached) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as NotificationsModule;

    // Foreground notifications still show a banner/sound. Without this
    // handler they're delivered silently while the app is open. Set here
    // rather than at module scope so it follows the same lazy path.
    cached.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }

  return cached;
}

// Registering a push token requires an EAS project id, which this app
// doesn't have linked yet (see docs/MILESTONES.md Milestone 16) — until
// `eas init` is run and app.json's extra.eas.projectId is set, this no-ops
// with a warning instead of throwing, so the rest of the app is unaffected.
export async function registerForPushNotificationsAsync(userId: string): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications) return;

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
export function handleNotificationResponse(
  response: ExpoNotifications.NotificationResponse,
): void {
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

/**
 * Always returns something with `remove()` so callers can treat the cleanup
 * path identically whether or not push is available.
 */
export function addNotificationResponseListener(): { remove: () => void } {
  const Notifications = loadNotifications();
  if (!Notifications) return { remove: () => {} };

  return Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
}
