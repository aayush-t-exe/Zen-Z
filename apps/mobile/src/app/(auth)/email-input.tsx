import { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { AuthButton } from '@/components/auth-button';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';

const HEADER_RATIO = 389 / 814;
const FIELD_RATIO = 658 / 1386;

export default function EmailInputScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const setAuthError = useAuthStore((state) => state.setError);

  const headerWidth = Math.min(360, screenWidth - 40);
  const fieldWidth = Math.min(358, screenWidth - 30);
  const fieldHeight = fieldWidth * FIELD_RATIO;

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
            editable={!isLoading}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="go"
            onSubmitEditing={handleContinue}
            accessibilityLabel="Email address"
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
        </View>

        {error ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        <AuthButton
          label="Continue  →"
          onPress={handleContinue}
          loading={isLoading}
          style={{ width: fieldWidth, marginTop: 52 }}
        />
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
    // Top-aligned so the mark sits at the same height as it does on every
    // onboarding slide, rather than floating in the middle of the screen.
    paddingTop: 56,
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  title: {
    color: Palette.text,
    fontSize: 36,
    lineHeight: 45,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.9,
    marginTop: 32,
    marginBottom: 28,
  },
  input: {
    position: 'absolute',
    color: Palette.fieldInk,
    fontSize: 19,
    fontWeight: '500',
    textAlign: 'center',
    textAlignVertical: 'center',
    padding: 0,
  },
  error: {
    color: Palette.error,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 8,
  },
});
