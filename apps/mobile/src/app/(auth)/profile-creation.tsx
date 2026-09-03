import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  Platform,
  Alert,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  FLOW_CONTENT_MAX,
  FLOW_SIDE_PADDING,
  FlowSurface,
  FlowText,
} from '@/constants/flow-theme';
import { FlowBackArrow } from '@/components/flow-back-button';
import { FlowField, FlowFieldButton, FlowPanel } from '@/components/flow-panel';
import { FlowPillButton } from '@/components/flow-pill-button';
import { QuizProgressBar } from '@/components/quiz-progress-bar';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';

const YEARS: { label: string; value: number }[] = [
  { label: '1st year', value: 1 },
  { label: '2nd year', value: 2 },
  { label: '3rd year', value: 3 },
  { label: '4th year', value: 4 },
  { label: 'Other', value: 5 },
];
const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];

const STEP_COUNT = 6;
const MIN_AGE_YEARS = 18;

// Exactly 10 digits, no spaces/dashes/parens/+ — a WhatsApp contact
// number, not an auth identity, but standardized on a plain Indian mobile
// number (no country code) per founder direction.
const PHONE_PATTERN = /^\d{10}$/;

function isValidPhone(value: string): boolean {
  return PHONE_PATTERN.test(value);
}

function isValidName(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && !/\d/.test(trimmed);
}

function defaultDob() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 18);
  return date;
}

function formatDob(date: Date) {
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function ProfileCreationScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const user = useAuthStore((state) => state.user);
  const setAuthError = useAuthStore((state) => state.setError);

  // Same content column the booking flow runs, so a row is the same width
  // either side of the sign-up boundary.
  const contentWidth = Math.min(FLOW_CONTENT_MAX, screenWidth - FLOW_SIDE_PADDING * 2);

  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === 'ios');
  const [yearOfStudy, setYearOfStudy] = useState<number | null>(null);
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  // Lazy initializer so `Date.now()` runs once on mount, not on every render.
  const [maxDobDate] = useState(() => new Date(Date.now() - MIN_AGE_YEARS * 365.25 * 24 * 60 * 60 * 1000));

  const canAdvance = [
    isValidName(fullName),
    dateOfBirth !== null,
    yearOfStudy !== null,
    gender !== '',
    isValidPhone(phone.trim()),
    true, // step 5's own check below handles the photo, so the student sees a real message instead of a silently-disabled button
  ][step];

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need permission to access your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled) {
      // fetch(uri).blob() doesn't reliably read a picked photo's actual bytes
      // on native (it was silently uploading a ~14-byte placeholder instead
      // of the real JPEG) — asking the picker for base64 directly and
      // decoding it below is the platform-recommended path for Supabase
      // Storage uploads from Expo.
      setPhotoUri(result.assets[0].uri);
      setPhotoBase64(result.assets[0].base64 ?? null);
      setError('');
    }
  };

  const handleDateValueChange = (_event: any, selected: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    setDateOfBirth(selected);
    setError('');
  };

  const handleDateDismiss = () => {
    if (Platform.OS === 'android') setShowDatePicker(false);
  };

  const handleBack = () => {
    if (step === 0) {
      router.back();
      return;
    }
    setStep(step - 1);
  };

  const handleNext = () => {
    if (!canAdvance) return;

    if (step === 0 && !isValidName(fullName)) {
      setError('Enter your full name without any numbers.');
      return;
    }

    // maximumDate on the native picker (below) is the first line of
    // defense, but Android's date-picker widget doesn't consistently
    // enforce it across every OEM skin — so a too-young date can still
    // reach state here and needs its own check before advancing, with a
    // real message instead of a silently-disabled Continue button.
    if (step === 1 && dateOfBirth && dateOfBirth > maxDobDate) {
      setError(`You need to be at least ${MIN_AGE_YEARS} to use Zen-Z.`);
      return;
    }

    if (step === 4 && !isValidPhone(phone.trim())) {
      setError('Enter a valid WhatsApp number.');
      return;
    }

    if (step === 5 && !photoUri) {
      setError('Add a photo before continuing.');
      return;
    }

    if (step < STEP_COUNT - 1) {
      setStep(step + 1);
      return;
    }
    handleCreateProfile();
  };

  const handleCreateProfile = async () => {
    if (!isValidName(fullName) || !dateOfBirth || yearOfStudy === null || !gender || !isValidPhone(phone.trim())) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      if (!user) {
        setError('User not authenticated');
        return;
      }

      const currentUser = user;
      const dobIso = dateOfBirth.toISOString().slice(0, 10);

      // Almost always a no-op — handle_new_user() already created this row
      // at signup. Only matters for an account whose profiles row is
      // missing for some other reason (found live: a handful of accounts
      // with a real auth.users row but no matching profile), where the
      // plain .update() below would otherwise silently match zero rows and
      // report success without ever actually creating the profile.
      const { error: ensureError } = await supabase.rpc('ensure_own_profile');
      if (ensureError) {
        setError(ensureError.message);
        setAuthError(ensureError.message);
        return;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          date_of_birth: dobIso,
          year_of_study: yearOfStudy,
          // profiles_gender_check (0001_init.sql) requires snake_case
          // ('prefer_not_to_say'), but GENDERS holds display labels with
          // spaces ('Prefer not to say') — toLowerCase() alone left the
          // space in, tripping the check constraint on submit.
          gender: gender.toLowerCase().replace(/\s+/g, '_'),
          phone: phone.trim(),
          // The server (enforce_referred_by_code_immutable) normalizes and
          // validates this too — uppercasing here just avoids a round-trip
          // failure for the common case of a lowercase-typed code.
          ...(referralCode.trim() ? { referred_by_code: referralCode.trim().toUpperCase() } : {}),
        })
        .eq('id', currentUser.id);

      if (profileError) {
        // A nonexistent code trips the referred_by_code FK; the Postgres
        // message for that ("...violates foreign key constraint
        // profiles_referred_by_code_fkey...") isn't something a student
        // should ever see. The self-referral case already raises a
        // readable message from enforce_referred_by_code_immutable, so
        // it passes through as-is.
        const message = profileError.message.includes('profiles_referred_by_code_fkey')
          ? "That invite code doesn't look right."
          : profileError.message;
        setError(message);
        setAuthError(message);
        return;
      }

      if (photoUri && photoBase64) {
        const fileName = `${currentUser.id}/profile.jpg`;

        // upsert: true — without it, re-running onboarding on a test account
        // that already has a profile.jpg silently keeps the *old* file
        // (upload() refuses to overwrite by default), which is exactly how a
        // stale/corrupt earlier upload could survive a later, correct retry.
        const { error: uploadError } = await supabase.storage
          .from('profile-photos')
          .upload(fileName, decode(photoBase64), { contentType: 'image/jpeg', upsert: true });

        if (uploadError) {
          setError('Failed to upload photo');
          return;
        }

        // Store the storage path, not a public URL — the bucket is private,
        // and the admin dashboard resolves this path to a signed URL via
        // get_student_photo_url() (see supabase/migrations/0004_storage_helpers.sql).
        await supabase.from('profiles').update({ photo_url: fileName }).eq('id', currentUser.id);
      }

      (router.push as any)({
        pathname: '/(auth)/personality-quiz',
        params: { name: fullName.trim() },
      });
    } catch (err: any) {
      setError(err.message || 'Failed to create profile');
      setAuthError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={{ width: contentWidth, flex: 1 }}>
        <View style={styles.header}>
          <FlowBackArrow onPress={handleBack} />
          <View style={{ flex: 1, marginLeft: 16 }}>
            <QuizProgressBar step={step} total={STEP_COUNT} />
          </View>
        </View>

        <View style={styles.body}>
          {step === 0 && (
            <StepShell title="What's your name?">
              <FlowField
                width={contentWidth}
                placeholder="Your full name"
                value={fullName}
                onChangeText={setFullName}
                editable={!isLoading}
                autoFocus
              />
              <View style={{ marginTop: 20, gap: 10 }}>
                <Text style={FlowText.fine}>Have an invite code?</Text>
                <FlowField
                  width={contentWidth}
                  placeholder="Optional"
                  value={referralCode}
                  onChangeText={(text) => setReferralCode(text.toUpperCase())}
                  editable={!isLoading}
                  autoCapitalize="characters"
                />
              </View>
            </StepShell>
          )}

          {step === 1 && (
            <StepShell title="When's your birthday?" subtitle="We'll never show this to anyone else.">
              {Platform.OS === 'android' && !showDatePicker && (
                <FlowFieldButton
                  width={contentWidth}
                  value={dateOfBirth ? formatDob(dateOfBirth) : null}
                  placeholder="Choose your date of birth"
                  onPress={() => setShowDatePicker(true)}
                />
              )}
              {showDatePicker && (
                <DateTimePicker
                  value={dateOfBirth ?? defaultDob()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  maximumDate={maxDobDate}
                  onValueChange={handleDateValueChange}
                  onDismiss={handleDateDismiss}
                  themeVariant="dark"
                />
              )}
            </StepShell>
          )}

          {step === 2 && (
            <StepShell title="Which year are you in?">
              <View style={{ gap: 14 }}>
                {YEARS.map((year) => (
                  <FlowPanel
                    key={year.value}
                    label={year.label}
                    width={contentWidth}
                    selected={yearOfStudy === year.value}
                    dimmed={yearOfStudy !== null && yearOfStudy !== year.value}
                    onPress={() => setYearOfStudy(year.value)}
                  />
                ))}
              </View>
            </StepShell>
          )}

          {step === 3 && (
            <StepShell title="How do you define yourself?">
              <View style={{ gap: 14 }}>
                {GENDERS.map((g) => (
                  <FlowPanel
                    key={g}
                    label={g}
                    width={contentWidth}
                    selected={gender === g}
                    dimmed={gender !== '' && gender !== g}
                    onPress={() => setGender(g)}
                  />
                ))}
              </View>
            </StepShell>
          )}

          {step === 4 && (
            <StepShell title="What's your WhatsApp number?" subtitle="We'll use this to reach you about event details.">
              <FlowField
                width={contentWidth}
                placeholder="9XXXXXXXXX"
                value={phone}
                onChangeText={(text) => setPhone(text.replace(/\D/g, '').slice(0, 10))}
                editable={!isLoading}
                keyboardType="number-pad"
                maxLength={10}
                autoFocus
              />
            </StepShell>
          )}

          {step === 5 && (
            <StepShell title="Add a photo">
              <Pressable
                onPress={handlePickImage}
                disabled={isLoading}
                accessibilityRole="button"
                accessibilityLabel="Add a photo">
                <View style={styles.photoPicker}>
                  {photoUri ? (
                    <Image
                      source={{ uri: photoUri }}
                      style={styles.photoPreview}
                      accessibilityIgnoresInvertColors
                    />
                  ) : (
                    <Text style={FlowText.panelLabel}>Upload</Text>
                  )}
                </View>
              </Pressable>
              <Text style={[FlowText.fine, styles.privacyLine]}>
                This photo is seen only by our team, to help us craft the right group for you —
                never by other members.
              </Text>
            </StepShell>
          )}

          {error ? (
            <Text style={[FlowText.error, styles.error]} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
        </View>

        <View style={styles.footer}>
          <FlowPillButton
            label="Continue  →"
            width={contentWidth}
            onPress={handleNext}
            loading={isLoading}
            disabled={!canAdvance}
          />
        </View>
      </View>
    </View>
  );
}

function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 28 }}>
      <View style={{ gap: 12 }}>
        <Text style={FlowText.title}>{title}</Text>
        {subtitle ? <Text style={FlowText.subtitle}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  body: {
    flex: 1,
  },
  footer: {
    paddingTop: 12,
  },
  // A circle can't come from the row art (stretching a 902x154 box to a
  // square distorts its corners), so this is one of the few coded surfaces —
  // matched to the art's fill and stroke by value. See FlowSurface.
  photoPicker: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: FlowSurface.stroke,
    backgroundColor: FlowSurface.fill,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  privacyLine: {
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  error: {
    marginTop: 20,
  },
});
