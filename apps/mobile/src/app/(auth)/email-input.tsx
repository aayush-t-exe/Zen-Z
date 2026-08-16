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
  const setAuthError = useAuthStore((state) => state.setError);

  const handleContinue = async () => {
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
        },
      });

      if (otpError) {
        setError(otpError.message);
        setAuthError(otpError.message);
        return;
      }

      router.push({
        pathname: '/(auth)/otp-verification',
        params: { email: email.trim() },
      });
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
          <ThemedText type="default" themeColor="error">
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
            <ThemedText themeColor="onLight" className="text-center font-semibold">
              Continue →
            </ThemedText>
          )}
        </Pressable>
      </View>
    </ThemedView>
  );
}
