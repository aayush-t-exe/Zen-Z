import { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Text,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FontFamily } from '@/constants/fonts';
import { AuthButton } from '@/components/auth-button';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { getPostAuthRoute } from '@/lib/authRouting';
import { getAuthErrorMessage } from '@/lib/authErrors';

const HEADER_RATIO = 389 / 814;

export default function OTPVerificationScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { width: screenWidth } = useWindowDimensions();
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const canResend = resendTimer <= 0;
  const inputRef = useRef<TextInput>(null);
  // `isLoading` alone isn't a tight enough guard: it's a state update, so a
  // second tap landing before that update has re-rendered (and disabled the
  // button) still gets through. Found live — verifying once was creating
  // *two* auth sessions per code entry (confirmed via auth.sessions,
  // ~16-30s apart), which then left the app juggling two valid-looking
  // sessions and unpredictable about which one it actually used for
  // subsequent calls. A synchronous ref closes that window outright.
  const isVerifyingRef = useRef(false);

  const setSession = useAuthStore((state) => state.setSession);
  const setUser = useAuthStore((state) => state.setUser);
  const setAuthError = useAuthStore((state) => state.setError);

  const headerWidth = Math.min(360, screenWidth - 40);
  const contentWidth = Math.min(358, screenWidth - 30);
  const boxGap = 9;
  const boxWidth = (contentWidth - boxGap * 5) / 6;

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

    if (isVerifyingRef.current) return;
    isVerifyingRef.current = true;

    setIsLoading(true);
    setError('');

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email || '',
        token: otp.trim(),
        type: 'email',
      });

      if (verifyError) {
        const message = getAuthErrorMessage(verifyError);
        setError(message);
        setAuthError(message);
        return;
      }

      if (data.session && data.user) {
        setSession(data.session);
        setUser(data.user);
        const nextRoute = await getPostAuthRoute(data.user.id);
        router.replace(nextRoute);
      }
    } catch (err: any) {
      const message = getAuthErrorMessage(err);
      setError(message);
      setAuthError(message);
    } finally {
      isVerifyingRef.current = false;
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
        setError(getAuthErrorMessage(resendError));
      }
    } catch (err: any) {
      setError(getAuthErrorMessage(err));
    }
  };

  const focusCode = () => {
    // Android's hardware back button dismisses the keyboard without blurring
    // the TextInput, so it still thinks it's focused and a plain .focus() is a
    // no-op — force blur first so focus() isn't ignored. requestAnimationFrame
    // isn't a long enough gap for Android's InputMethodManager to actually
    // release focus before the re-focus call lands, so use a short real delay.
    inputRef.current?.blur();
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Image
          source={require('@/assets/images/auth-header.png')}
          style={{ width: headerWidth, height: headerWidth * HEADER_RATIO }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />

        <Text style={styles.title}>Check your inbox</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code sent to{'\n'}
          {email}
        </Text>

        <Pressable
          onPress={focusCode}
          accessibilityRole="button"
          accessibilityLabel="Enter the 6-digit code"
          style={[styles.boxes, { width: contentWidth, gap: boxGap }]}>
          {Array.from({ length: 6 }).map((_, i) => {
            const digit = otp[i];
            const isActive = i === otp.length && otp.length < 6 && !isLoading;
            return (
              <View
                key={i}
                style={[
                  styles.box,
                  { width: boxWidth, height: boxWidth * 1.18 },
                  isActive && styles.boxActive,
                ]}>
                <Text style={styles.digit}>{digit ?? ''}</Text>
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
          style={styles.hiddenInput}
        />

        {error ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        <AuthButton
          label="Verify  →"
          onPress={handleVerifyOTP}
          loading={isLoading}
          style={{ width: contentWidth, marginTop: 40 }}
        />

        <Pressable
          onPress={handleResendOTP}
          disabled={!canResend || isLoading}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canResend || isLoading }}>
          {({ pressed }) => (
            <Text style={[styles.resend, pressed && styles.pressedText]}>
              {canResend ? "Didn't get it? Resend" : `Resend in ${resendTimer}s`}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Palette.canvas,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  title: {
    color: Palette.text,
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '700',
    fontFamily: FontFamily.display.bold,
    textAlign: 'center',
    letterSpacing: -0.8,
    marginTop: 30,
  },
  subtitle: {
    color: Palette.text,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '400',
    fontFamily: FontFamily.body.regular,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 28,
  },
  boxes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  box: {
    backgroundColor: Palette.paper,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  boxActive: {
    borderColor: Palette.ring,
  },
  digit: {
    color: Palette.line,
    fontSize: 24,
    fontWeight: '700',
    fontFamily: FontFamily.body.bold,
  },
  // Off-screen field that actually holds the code; the boxes above are a
  // display of its value.
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
  error: {
    color: Palette.error,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: FontFamily.body.semiBold,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 8,
  },
  resend: {
    color: Palette.text,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily.body.semiBold,
    textAlign: 'center',
    marginTop: 22,
  },
  pressedText: {
    opacity: 0.6,
  },
});
