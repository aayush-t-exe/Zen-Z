/**
 * Regression test for the crash that stopped the app opening in Expo Go.
 *
 * expo-notifications' DevicePushTokenAutoRegistration.fx module calls
 * warnOfExpoGoPushUsage() at import time, and on Android in Expo Go that
 * THROWS rather than warning. Because lib/notifications.ts imported the
 * package at module scope, the throw propagated to every dependent module:
 * (home)/_layout.tsx never evaluated, Expo Router reported "missing the
 * required default export", and rendering died on "Cannot read property
 * 'ErrorBoundary' of undefined".
 *
 * The guard is that expo-notifications must never be reached during import,
 * and must not be reached at all while running in Expo Go.
 */

// require() is deliberate throughout: these tests assert on *when* modules
// are evaluated, which a hoisted import statement would make impossible.
/* eslint-disable @typescript-eslint/no-require-imports */

const mockIsRunningInExpoGo = jest.fn(() => true);

jest.mock('expo', () => ({
  isRunningInExpoGo: () => mockIsRunningInExpoGo(),
}));

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

// Stands in for the real package, which throws on Android in Expo Go.
// Touching it at all while in Expo Go is the bug.
const mockExpoNotificationsTouched = jest.fn();
jest.mock('expo-notifications', () => {
  mockExpoNotificationsTouched();
  return {
    setNotificationHandler: jest.fn(),
    addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  };
});

describe('notifications in Expo Go', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsRunningInExpoGo.mockReturnValue(true);
  });

  it('imports without evaluating expo-notifications', () => {
    jest.isolateModules(() => {
      expect(() => require('./notifications')).not.toThrow();
    });
    expect(mockExpoNotificationsTouched).not.toHaveBeenCalled();
  });

  it('registering push is a no-op rather than a throw', async () => {
    const { registerForPushNotificationsAsync } = require('./notifications');
    await expect(registerForPushNotificationsAsync('user-1')).resolves.toBeUndefined();
    expect(mockExpoNotificationsTouched).not.toHaveBeenCalled();
  });

  it('returns a removable subscription so callers need no special case', () => {
    const { addNotificationResponseListener } = require('./notifications');
    const subscription = addNotificationResponseListener();

    // (home)/_layout.tsx calls this unconditionally in its effect cleanup.
    expect(() => subscription.remove()).not.toThrow();
    expect(mockExpoNotificationsTouched).not.toHaveBeenCalled();
  });

  it('still loads the real module outside Expo Go', () => {
    mockIsRunningInExpoGo.mockReturnValue(false);
    const { addNotificationResponseListener } = require('./notifications');

    addNotificationResponseListener();
    expect(mockExpoNotificationsTouched).toHaveBeenCalled();
  });
});
