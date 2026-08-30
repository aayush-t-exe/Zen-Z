import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { secureSessionStorage } from '@/lib/secureSessionStorage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// supabase-js defaults to localStorage for session persistence, which
// doesn't exist in React Native — without an explicit storage adapter,
// sessions silently fail to survive an app restart. secureSessionStorage
// keeps the session encrypted at rest (see that file for why plain
// AsyncStorage isn't enough and plain SecureStore isn't big enough).
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureSessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// autoRefreshToken's setInterval tick doesn't run reliably while an RN app
// is backgrounded (the JS engine itself gets suspended), so a session can
// come back from the background with an access token past its expiry and
// no refresh ever having been attempted. Per Supabase's own React Native
// guidance, foregrounding must explicitly kick the refresh loop back on —
// backgrounding stops it so it isn't ticking (and burning battery) for no
// reason while nothing can use it anyway.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
