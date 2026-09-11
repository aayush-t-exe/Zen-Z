import { useEffect, useState } from 'react';
import {
  View,
  TextInput,
  Text,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FontFamily } from '@/constants/fonts';
import { FlowText, flowTracking } from '@/constants/flow-theme';
import { FlowPillButton } from '@/components/flow-pill-button';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { getAuthErrorMessage } from '@/lib/authErrors';

const HEADER_RATIO = 389 / 814;
const FIELD_RATIO = 658 / 1386;

// Deliberately permissive (matches Supabase Auth's own leniency) — this
// only needs to catch obviously-malformed input before spending an OTP
// send, not fully validate RFC 5322 email syntax.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailInputScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const setAuthError = useAuthStore((state) => state.setError);

  const headerWidth = Math.min(360, screenWidth - 40);
  const fieldWidth = Math.min(358, screenWidth - 30);
  const fieldHeight = fieldWidth * FIELD_RATIO;

  // The native cursor for an empty, center-aligned TextInput renders off to
  // one side on both iOS and Android instead of at the visual center — a
  // platform caret-gravity quirk, not something `textAlign` controls. So
  // while the field is empty and focused we hide the real caret and blink
  // this centered fake one in its place; once there's text, the native
  // caret is accurately positioned by the (now non-empty) content and takes
  // back over.
  const showFakeCaret = isFocused && email.length === 0;
  const [caretOpacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!showFakeCaret) return;

    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(caretOpacity, { toValue: 0, duration: 530, useNativeDriver: true }),
        Animated.timing(caretOpacity, { toValue: 1, duration: 530, useNativeDriver: true }),
      ])
    );
    blink.start();

    return () => {
      blink.stop();
      caretOpacity.setValue(1);
    };
  }, [showFakeCaret, caretOpacity]);

  const handleContinue = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError('Please enter your email');
      return;
    }

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError("That doesn't look like a valid email");
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          shouldCreateUser: true,
        },
      });

      if (otpError) {
        const message = getAuthErrorMessage(otpError);
        setError(message);
        setAuthError(message);
        return;
      }

      router.push({
        pathname: '/(auth)/otp-verification',
        params: { email: trimmedEmail },
      });
    } catch (err: any) {
      const message = getAuthErrorMessage(err);
      setError(message);
      setAuthError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      // 'undefined' on Android meant the keyboard had nothing pushing it
      // back into view — normally not noticeable, but a large system font
      // scale grows the title enough that the field can end up sitting
      // right where the keyboard now covers it. 'height' is the same fix
      // already used for this on booking-flow.tsx and group/[groupId].tsx.
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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

        {/* The break is deliberate — it is the line split in the design. */}
        <Text style={styles.title}>{'Where should\nwe send your\ninvitation?'}</Text>

        <View style={{ width: fieldWidth, height: fieldHeight }}>
          <Image
            source={require('@/assets/images/auth-field.png')}
            style={{ position: 'absolute', width: fieldWidth, height: fieldHeight }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <TextInput
            placeholder="you@email.com"
            placeholderTextColor={Palette.placeholder}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setError('');
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            editable={!isLoading}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="go"
            onSubmitEditing={handleContinue}
            accessibilityLabel="Email address"
            caretHidden={showFakeCaret}
            cursorColor={showFakeCaret ? 'transparent' : Palette.fieldInk}
            // Sits inside the drawn bubble, clear of its wobbly edges and tail.
            style={[
              styles.input,
              {
                left: fieldWidth * 0.09,
                right: fieldWidth * 0.09,
                top: fieldHeight * 0.22,
                height: fieldHeight * 0.36,
              },
            ]}
          />
          {showFakeCaret ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.fakeCaret,
                {
                  left: fieldWidth / 2,
                  top: fieldHeight * 0.22 + fieldHeight * 0.36 * 0.2,
                  height: fieldHeight * 0.36 * 0.6,
                  backgroundColor: Palette.fieldInk,
                  opacity: caretOpacity,
                },
              ]}
            />
          ) : null}
        </View>

        {error ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        <FlowPillButton
          label="Continue  →"
          onPress={handleContinue}
          loading={isLoading}
          // alignSelf overrides the `alignSelf: 'stretch'` FlowPillButton
          // applies when it is given no `width` prop: stretch is not a
          // centring value, so a pill handed a width through `style` instead
          // fell back to flex-start and sat left of the field above it.
          style={{ width: fieldWidth, alignSelf: 'center', marginTop: 52 }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    // Top-aligned so the mark sits at the same height as it does on every
    // onboarding slide, rather than floating in the middle of the screen.
    paddingTop: 56,
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  title: {
    ...FlowText.display,
    fontSize: 36,
    lineHeight: 45,
    letterSpacing: flowTracking(36),
    marginTop: 32,
    marginBottom: 28,
  },
  input: {
    position: 'absolute',
    color: Palette.fieldInk,
    fontSize: 19,
    fontFamily: FontFamily.accent.sfProDisplayMedium,
    textAlign: 'center',
    textAlignVertical: 'center',
    padding: 0,
  },
  fakeCaret: {
    position: 'absolute',
    width: 1.5,
    borderRadius: 1,
  },
  error: {
    ...FlowText.error,
    marginTop: 16,
    paddingHorizontal: 8,
  },
});
