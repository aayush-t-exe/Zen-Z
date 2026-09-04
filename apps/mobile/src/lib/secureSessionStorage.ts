import 'react-native-get-random-values';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as aesjs from 'aes-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Sentry } from '@/lib/sentry';

// Supabase's session payload (access + refresh token, user metadata) is
// larger than SecureStore's ~2048-byte per-value limit on Android, so the
// session itself can't live in SecureStore directly. This follows
// Supabase's documented React Native pattern instead: encrypt the session
// with a random AES key, store only that small key in SecureStore (OS
// Keychain/Keystore), and keep the encrypted (unreadable without the key)
// blob in AsyncStorage. Net effect: AsyncStorage no longer holds a plain-
// text session even though it still holds the bulk of the data.
class LargeSecureStore {
  // Was: a brand-new random AES key generated (and written to SecureStore)
  // on every single setItem call, while the matching ciphertext landed in
  // a *separate* AsyncStorage write. supabase-js calls setItem on every
  // token refresh, not just at login, so this made every refresh a
  // two-store atomicity problem: if the app got killed (Android backgrounds
  // RN apps aggressively) between the SecureStore write and the AsyncStorage
  // write, the two fell out of sync — the key in SecureStore no longer
  // matched the ciphertext in AsyncStorage, decrypt() silently failed, and
  // the session was gone on next launch. Reusing one key per storage slot
  // (generated once, reused thereafter) means only the very first-ever
  // write has that two-store window; every later session refresh only
  // touches AsyncStorage.
  private async getOrCreateEncryptionKey(key: string): Promise<Uint8Array> {
    const existing = await SecureStore.getItemAsync(key);
    if (existing) return aesjs.utils.hex.toBytes(existing);

    const generated = crypto.getRandomValues(new Uint8Array(256 / 8));
    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(generated));
    return generated;
  }

  private async encrypt(key: string, value: string): Promise<string> {
    const encryptionKey = await this.getOrCreateEncryptionKey(key);
    // The key is now stable across writes, so a fixed counter would reuse
    // the exact same keystream for every session update (a classic
    // stream-cipher weakness) — a random 16-byte counter per write avoids
    // that. It isn't secret, so it travels alongside the ciphertext.
    const counterBytes = crypto.getRandomValues(new Uint8Array(16));
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(counterBytes));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));

    return `${aesjs.utils.hex.fromBytes(counterBytes)}:${aesjs.utils.hex.fromBytes(encryptedBytes)}`;
  }

  private async decrypt(key: string, value: string): Promise<string | null> {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) {
      // TEMPORARY diagnostic (2026-09-04): pinpoints whether the reported
      // "logged out after closing from recents" bug is SecureStore
      // (Android Keystore) losing the encryption key specifically, as
      // opposed to AsyncStorage losing the ciphertext (see the getItem
      // breadcrumb below) or something entirely outside this storage
      // layer. Remove once the real cause is confirmed from Sentry data.
      Sentry.captureMessage('secureSessionStorage: ciphertext present but SecureStore key missing', {
        level: 'warning',
        tags: { diagnostic: 'session-persistence-2026-09-04' },
      });
      return null;
    }

    const separatorIndex = value.indexOf(':');
    // Falls back to the old fixed-counter format for a value written
    // before this fix — otherwise every session in the wild would be
    // silently logged out again the moment this ships.
    const [counterHex, cipherHex] =
      separatorIndex === -1 ? ['01', value] : [value.slice(0, separatorIndex), value.slice(separatorIndex + 1)];

    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      separatorIndex === -1 ? new aesjs.Counter(1) : new aesjs.Counter(aesjs.utils.hex.toBytes(counterHex))
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(cipherHex));

    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) {
      // TEMPORARY diagnostic (2026-09-04) — see the matching note in
      // decrypt(). This is the other half: AsyncStorage itself has
      // nothing for this key, meaning the ciphertext was never written or
      // didn't survive, rather than the key being the missing half.
      Sentry.captureMessage('secureSessionStorage: AsyncStorage has no stored session for this key', {
        level: 'warning',
        tags: { diagnostic: 'session-persistence-2026-09-04' },
      });
      return null;
    }

    const result = await this.decrypt(key, encrypted);
    // TEMPORARY diagnostic (2026-09-04): both stores had something, but
    // did decrypt() actually produce a usable session back out?
    Sentry.captureMessage(
      result ? 'secureSessionStorage: session restored successfully' : 'secureSessionStorage: decrypt returned null despite both stores having data',
      { level: result ? 'info' : 'warning', tags: { diagnostic: 'session-persistence-2026-09-04' } }
    );
    return result;
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await this.encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }
}

// expo-secure-store has no web implementation at all (throws if called),
// and web has no equivalent OS keychain to defend against — fall back to
// plain AsyncStorage there, same as before this change.
export const secureSessionStorage = Platform.OS === 'web' ? AsyncStorage : new LargeSecureStore();
