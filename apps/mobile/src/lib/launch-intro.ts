import AsyncStorage from '@react-native-async-storage/async-storage';

const SEEN_KEY = 'zenz.hasSeenJaipurIntro';

/** The full-screen "we're only in Jaipur" reveal — shown once ever, on the very first launch before a student signs up. */
export async function hasSeenJaipurIntro(): Promise<boolean> {
  return (await AsyncStorage.getItem(SEEN_KEY)) === '1';
}

export async function markJaipurIntroSeen(): Promise<void> {
  await AsyncStorage.setItem(SEEN_KEY, '1');
}
