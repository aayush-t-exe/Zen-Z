import { useEffect, useState } from 'react';
import { View, Pressable, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/components/icon';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const setSession = useAuthStore((state) => state.setSession);
  const setUser = useAuthStore((state) => state.setUser);

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(true);

  useEffect(() => {
    const loadPhoto = async () => {
      if (!user?.id) {
        setPhotoLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('photo_url')
        .eq('id', user.id)
        .single();

      // profiles.photo_url is a storage path, not a usable URL — the
      // bucket is private, so it has to be exchanged for a signed URL.
      // The "self read own photo" RLS policy is what makes this succeed
      // for a student's own path (and only their own).
      if (profile?.photo_url) {
        const { data } = await supabase.storage
          .from('profile-photos')
          .createSignedUrl(profile.photo_url, 3600);
        setPhotoUrl(data?.signedUrl ?? null);
      }

      setPhotoLoading(false);
    };

    loadPhoto();
  }, [user?.id]);

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

        <View className="mb-6 items-center">
          {photoLoading ? (
            <View className="h-24 w-24 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
              <ActivityIndicator />
            </View>
          ) : photoUrl ? (
            <Image
              source={{ uri: photoUrl }}
              className="h-24 w-24 rounded-full bg-gray-100 dark:bg-gray-800"
            />
          ) : (
            <View className="h-24 w-24 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
              <Icon name="camera" size={30} color={theme.textSecondary} />
            </View>
          )}
        </View>

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
          <ThemedText type="default" themeColor="textSecondary" className="text-xs font-semibold uppercase">
            Account
          </ThemedText>

          <Pressable
            onPress={handleSignOut}
            className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 dark:border-red-700 dark:bg-red-900"
          >
            <ThemedText themeColor="error" className="text-center font-semibold">
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
