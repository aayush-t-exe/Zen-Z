import { Alert, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as StoreReview from 'expo-store-review';

export const ANDROID_PACKAGE = 'com.campussocial.app';
export const INSTAGRAM_HANDLE = 'zen_z.app';

// The exact fallback profile.tsx's manual "Rate the app" settings row has
// always used, pulled out so both that button and the post-feedback
// prompt share one path instead of two copies drifting apart.
async function openStoreListing(): Promise<void> {
  // [ASSUMPTION] Not yet listed on either store (per Milestone 20 — no
  // store enrollment until fully tested), so Android opens the Play
  // Store's listing page for our package (works pre-launch too, just
  // shows a "not found" page until the app is published) and iOS — where
  // we don't have an App Store id yet — tells the student it's on the way
  // rather than opening a broken/unrelated link.
  if (Platform.OS === 'android') {
    const marketUrl = `market://details?id=${ANDROID_PACKAGE}`;
    const webUrl = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
    const canOpenMarket = await Linking.canOpenURL(marketUrl);
    await Linking.openURL(canOpenMarket ? marketUrl : webUrl);
    return;
  }
  Alert.alert('Coming soon', "We're not on the App Store just yet — hang tight.");
}

// expo-store-review was added for this without a fresh EAS build yet —
// its native module isn't necessarily compiled into whatever binary is
// currently installed, so a call here could throw "native module not
// found" instead of just returning false. Falls back to the plain store
// listing (the same thing profile.tsx's settings row already did) so this
// is safe to call from the moment it ships, not only after the next build
// actually lands.
export async function requestAppReview(): Promise<void> {
  try {
    if (await StoreReview.isAvailableAsync()) {
      await StoreReview.requestReview();
      return;
    }
  } catch (err) {
    console.warn('[social-actions] native review prompt unavailable, falling back:', err);
  }
  await openStoreListing();
}

export async function followInstagram(): Promise<void> {
  const appUrl = `instagram://user?username=${INSTAGRAM_HANDLE}`;
  const webUrl = `https://www.instagram.com/${INSTAGRAM_HANDLE}`;
  const canOpenApp = await Linking.canOpenURL(appUrl);
  await Linking.openURL(canOpenApp ? appUrl : webUrl);
}
