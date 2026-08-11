import { View, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const setSession = useAuthStore((state) => state.setSession);
  const setUser = useAuthStore((state) => state.setUser);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      router.replace('/(auth)/onboarding');
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  };

  return (
    <ThemedView className="flex-1">
      <ScrollView className="flex-1 px-6 py-8">
        <ThemedText type="title" className="mb-6 text-xl">
          Your Profile
        </ThemedText>

        <View className="mb-6 gap-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <View>
            <ThemedText type="default" className="font-semibold">
              Email
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" className="mt-1">
              {user?.email || 'Not set'}
            </ThemedText>
          </View>
        </View>

        <View className="mb-8 gap-2">
          <ThemedText type="default" className="text-xs font-semibold uppercase text-gray-500">
            Account
          </ThemedText>

          <Pressable
            onPress={handleSignOut}
            className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 dark:border-red-700 dark:bg-red-900"
          >
            <ThemedText className="text-center font-semibold text-red-600 dark:text-red-400">
              Sign Out
            </ThemedText>
          </Pressable>
        </View>

        <ThemedText type="default" themeColor="textSecondary" className="text-xs">
          App Version: 1.0.0
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}
