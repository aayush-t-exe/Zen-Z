import { useState, useEffect, useRef } from 'react';
import { View, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { getPostAuthRoute } from '@/lib/authRouting';

export default function OTPVerificationScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const canResend = resendTimer <= 0;
  const inputRef = useRef<TextInput>(null);

  const setSession = useAuthStore((state) => state.setSession);
  const setUser = useAuthStore((state) => state.setUser);
  const setAuthError = useAuthStore((state) => state.setError);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setTimeout(() => setResendTimer((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendTimer]);

  const handleVerifyOTP = async () => {
    if (!otp.trim() || otp.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email || '',
        token: otp.trim(),
        type: 'email',
      });

      if (verifyError) {
        setError(verifyError.message);
        setAuthError(verifyError.message);
        return;
      }

      if (data.session && data.user) {
        setSession(data.session);
        setUser(data.user);
        const nextRoute = await getPostAuthRoute(data.user.id);
        router.replace(nextRoute);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP');
      setAuthError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setResendTimer(60);
    setError('');

    try {
      const { error: resendError } = await supabase.auth.signInWithOtp({
        email: email || '',
        options: {
          shouldCreateUser: true,
        },
      });

      if (resendError) {
        setError(resendError.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP');
    }
  };

  return (
    <ThemedView className="flex-1 items-center justify-center px-6">
      <View className="w-full gap-6">
        <View className="gap-2">
          <ThemedText type="title" className="text-xl">
            Check your inbox
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            Enter the 6-digit code sent to {email}
          </ThemedText>
        </View>

        <Pressable
          onPress={() => {
            // Android's hardware back button dismisses the keyboard without
            // blurring the TextInput, so it still thinks it's focused and a
            // plain .focus() is a no-op — force blur first so focus() isn't
            // ignored. requestAnimationFrame isn't a long enough gap for
            // Android's InputMethodManager to actually release focus before
            // the re-focus call lands, so use a short real delay instead.
            inputRef.current?.blur();
            setTimeout(() => inputRef.current?.focus(), 100);
          }}
          className="flex-row gap-2"
        >
          {Array.from({ length: 6 }).map((_, i) => {
            const digit = otp[i];
            const isActive = i === otp.length && otp.length < 6 && !isLoading;
            return (
              <View
                key={i}
                className={`h-14 flex-1 items-center justify-center rounded-lg border ${
                  isActive
                    ? 'border-2 border-blue-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                <ThemedText className="text-2xl font-bold">{digit ?? ''}</ThemedText>
              </View>
            );
          })}
        </Pressable>

        <TextInput
          ref={inputRef}
          value={otp}
          onChangeText={(text) => {
            setOtp(text.replace(/[^0-9]/g, '').slice(0, 6));
            setError('');
          }}
          editable={!isLoading}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}
        />

        {error && (
          <ThemedText type="default" themeColor="error">
            {error}
          </ThemedText>
        )}

        <Pressable
          onPress={handleVerifyOTP}
          disabled={isLoading || otp.length !== 6}
          className="rounded-lg bg-white py-3 px-4 disabled:opacity-50"
        >
          {isLoading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <ThemedText themeColor="onLight" className="text-center font-semibold">
              Verify →
            </ThemedText>
          )}
        </Pressable>

        <Pressable
          onPress={handleResendOTP}
          disabled={!canResend || isLoading}
          className="disabled:opacity-50"
        >
          <ThemedText
            type="default"
            themeColor="textSecondary"
            className="text-center"
          >
            {canResend ? 'Didn\'t get it? Resend' : `Resend in ${resendTimer}s`}
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}
