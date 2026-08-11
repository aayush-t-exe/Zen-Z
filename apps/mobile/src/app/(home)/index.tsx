import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    useAuthStore.getState().signOut();
    router.replace('/(auth)/onboarding');
  };

  return (
    <ThemedView className="flex-1 items-center justify-center px-6">
      <View className="gap-4 text-center">
        <ThemedText type="title" className="text-2xl">
          Welcome!
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          Authenticated as: {user?.email}
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" className="text-sm">
          Real home screen screens start at Milestone 7 (Booking Flow)
        </ThemedText>

        <Pressable
          onPress={handleSignOut}
          className="mt-8 rounded-lg bg-white py-3 px-4"
        >
          <ThemedText className="text-center font-semibold text-black">
            Sign out
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}
