import { useState } from 'react';
import { View, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';

export default function EmailInputScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const setSession = useAuthStore((state) => state.setSession);
  const setUser = useAuthStore((state) => state.setUser);
  const setAuthError = useAuthStore((state) => state.setError);

  const handleContinue = async () => {
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const tempPassword = Math.random().toString(36).slice(2, 15);

      // Sign up user (creates account without email verification for dev)
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password: tempPassword,
      });

      if (signUpError) {
        setError(signUpError.message);
        setAuthError(signUpError.message);
        return;
      }

      // Use session from signup directly (no separate sign-in needed)
      if (data.session && data.user) {
        // Set session on Supabase client AND store
        await supabase.auth.setSession(data.session);
        setSession(data.session);
        setUser(data.user);
      }

      // Proceed to profile creation
      router.replace('/(auth)/profile-creation');
    } catch (err: any) {
      setError(err.message || 'Failed to proceed');
      setAuthError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemedView className="flex-1 items-center justify-center px-6">
      <View className="w-full gap-6">
        <View className="gap-2">
          <ThemedText type="title" className="text-xl">
            Where should we send your invitation?
          </ThemedText>
        </View>

        <TextInput
          placeholder="you@email.com"
          placeholderTextColor="#999"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setError('');
          }}
          editable={!isLoading}
          autoCapitalize="none"
          keyboardType="email-address"
          style={{ color: '#000', backgroundColor: '#fff', borderColor: '#d1d5db', borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16 }}
        />

        {error && (
          <ThemedText type="default" themeColor="textSecondary" className="text-red-500">
            {error}
          </ThemedText>
        )}

        <Pressable
          onPress={handleContinue}
          disabled={isLoading || !email.trim()}
          className="rounded-lg bg-white py-3 px-4 disabled:opacity-50"
        >
          {isLoading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <ThemedText className="text-center font-semibold text-black">
              Continue →
            </ThemedText>
          )}
        </Pressable>
      </View>
    </ThemedView>
  );
}
