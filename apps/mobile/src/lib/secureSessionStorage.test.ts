// Regression coverage for the session-persistence bug: a fresh random AES
// key generated on every write meant a session refresh's SecureStore write
// and AsyncStorage write had to both land for the session to survive an
// app restart — if the process got killed in between (routine on Android
// while backgrounded), the two fell out of sync and decrypt() silently
// failed, forcing the user to log in again. Fixed by reusing one key per
// storage slot; these tests prove that reuse and the resulting resilience,
// plus that a value written under the old fixed-counter format still
// decrypts (existing sessions in the wild shouldn't be logged out again
// the moment this ships).

import * as aesjs from 'aes-js';
import * as SecureStore from 'expo-secure-store';
import { secureSessionStorage } from './secureSessionStorage';

const mockSecureStoreData = new Map<string, string>();
const mockAsyncStorageData = new Map<string, string>();

// babel-plugin-jest-hoist moves these above the imports above regardless
// of source order, so this runs before secureSessionStorage is even
// evaluated despite appearing after it here.
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((key: string) => Promise.resolve(mockSecureStoreData.get(key) ?? null)),
  setItemAsync: jest.fn((key: string, value: string) => {
    mockSecureStoreData.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key: string) => {
    mockSecureStoreData.delete(key);
    return Promise.resolve();
  }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockAsyncStorageData.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockAsyncStorageData.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    mockAsyncStorageData.delete(key);
    return Promise.resolve();
  }),
}));

const STORE_KEY = 'sb-test-project-auth-token';

describe('secureSessionStorage', () => {
  beforeEach(() => {
    mockSecureStoreData.clear();
    mockAsyncStorageData.clear();
    jest.clearAllMocks();
  });

  it('round-trips a value through encrypt and decrypt', async () => {
    await secureSessionStorage.setItem(STORE_KEY, 'session-payload-one');
    const result = await secureSessionStorage.getItem(STORE_KEY);
    expect(result).toBe('session-payload-one');
  });

  it('reuses the same SecureStore-backed key across multiple writes, the actual fix', async () => {
    await secureSessionStorage.setItem(STORE_KEY, 'first-session');
    const keyAfterFirstWrite = mockSecureStoreData.get(STORE_KEY);

    // A session refresh, exactly like supabase-js calling setItem again
    // with an updated token — this used to overwrite the SecureStore key
    // with a brand-new random one on every call.
    await secureSessionStorage.setItem(STORE_KEY, 'refreshed-session');
    const keyAfterSecondWrite = mockSecureStoreData.get(STORE_KEY);

    expect(keyAfterSecondWrite).toBe(keyAfterFirstWrite);
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
  });

  it('still decrypts correctly after several writes (each write no longer risks the key)', async () => {
    await secureSessionStorage.setItem(STORE_KEY, 'session-a');
    await secureSessionStorage.setItem(STORE_KEY, 'session-b');
    await secureSessionStorage.setItem(STORE_KEY, 'session-c');

    expect(await secureSessionStorage.getItem(STORE_KEY)).toBe('session-c');
  });

  it('simulates the original bug: a key/ciphertext mismatch from an interrupted write now cannot happen on a refresh', async () => {
    await secureSessionStorage.setItem(STORE_KEY, 'first-session');
    const keyBeforeRefresh = mockSecureStoreData.get(STORE_KEY);

    // Simulate the process being killed after the AsyncStorage write of a
    // refresh but (hypothetically) before any SecureStore write — under
    // the fix there IS no SecureStore write on a refresh, so this can't
    // desync them the way the old code could.
    await secureSessionStorage.setItem(STORE_KEY, 'refreshed-session');

    expect(mockSecureStoreData.get(STORE_KEY)).toBe(keyBeforeRefresh);
    expect(await secureSessionStorage.getItem(STORE_KEY)).toBe('refreshed-session');
  });

  it('still decrypts a value written in the old fixed-counter format (no ":" separator)', async () => {
    // Recreate exactly what the pre-fix encrypt() produced: a raw hex
    // ciphertext with no counter prefix, using Counter(1).
    const key = new Uint8Array(32).fill(7);
    await SecureStore.setItemAsync(STORE_KEY, aesjs.utils.hex.fromBytes(key));
    const cipher = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(1));
    const oldFormatCiphertext = aesjs.utils.hex.fromBytes(cipher.encrypt(aesjs.utils.utf8.toBytes('legacy-session')));
    mockAsyncStorageData.set(STORE_KEY, oldFormatCiphertext);

    expect(await secureSessionStorage.getItem(STORE_KEY)).toBe('legacy-session');
  });

  it('returns null when nothing has ever been stored for that key', async () => {
    expect(await secureSessionStorage.getItem('never-written')).toBeNull();
  });

  it('removeItem clears both the ciphertext and its key', async () => {
    await secureSessionStorage.setItem(STORE_KEY, 'session-to-remove');
    await secureSessionStorage.removeItem(STORE_KEY);

    expect(mockAsyncStorageData.has(STORE_KEY)).toBe(false);
    expect(mockSecureStoreData.has(STORE_KEY)).toBe(false);
    expect(await secureSessionStorage.getItem(STORE_KEY)).toBeNull();
  });
});
