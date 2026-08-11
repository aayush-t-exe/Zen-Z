import { useState, useEffect } from 'react';
import { View, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';

export default function OTPVerificationScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  const setSession = useAuthStore((state) => state.setSession);
  const setUser = useAuthStore((state) => state.setUser);
  const setAuthError = useAuthStore((state) => state.setError);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
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

      if (data.session) {
        setSession(data.session);
        setUser(data.user);
        router.replace('/(auth)/profile-creation');
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
    setCanResend(false);
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

        <TextInput
          placeholder="[_][_][_][_][_][_]"
          placeholderTextColor="#999"
          value={otp}
          onChangeText={(text) => {
            setOtp(text.replace(/[^0-9]/g, '').slice(0, 6));
            setError('');
          }}
          editable={!isLoading}
          keyboardType="number-pad"
          maxLength={6}
          style={{ color: '#000', backgroundColor: '#fff', borderColor: '#d1d5db', borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, fontSize: 20, fontWeight: 'bold', textAlign: 'center', letterSpacing: 4 }}
        />

        {error && (
          <ThemedText type="default" themeColor="textSecondary" className="text-red-500">
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
            <ThemedText className="text-center font-semibold text-black">
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
