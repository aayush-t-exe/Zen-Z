import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { showAlert } from '@/lib/alert';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import {
  FLOW_CONTENT_MAX,
  FLOW_SIDE_PADDING,
  FlowSurface,
  FlowText,
} from '@/constants/flow-theme';
import { FlowBackArrow } from '@/components/flow-back-button';
import { DobField } from '@/components/dob-field';
import { FlowField, FlowPanel } from '@/components/flow-panel';
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

// Two screens, not one field per screen: Name/DOB/Year/Gender all group as
// "about you" (no typing but the name), Phone/Photo group as the last step —
// six single-field "next next next" taps read as busywork, per the founder's
// own tester feedback. Photo stays out of the first screen: it needs real
// visual room a dense field list would crowd.
const STEP_COUNT = 2;
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

export default function ProfileCreationScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const setAuthError = useAuthStore((state) => state.setError);

  // Same content column the booking flow runs, so a row is the same width
  // either side of the sign-up boundary.
  const contentWidth = Math.min(FLOW_CONTENT_MAX, screenWidth - FLOW_SIDE_PADDING * 2);

  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
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

  const canAdvance =
    step === 0
      ? isValidName(fullName) && dateOfBirth !== null && yearOfStudy !== null && gender !== ''
      : isValidPhone(phone.trim()); // this step's own check below handles the photo, so the student sees a real message instead of a silently-disabled button

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission needed', 'We need permission to access your photos');
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

  const handleBack = () => {
    if (step === 0) {
      router.back();
      return;
    }
    setStep(step - 1);
  };

  const handleNext = async () => {
    if (!canAdvance) return;

    if (step === 0) {
      if (!isValidName(fullName)) {
        setError('Enter your full name without any numbers.');
        return;
      }

      // The calendar (dob-field.tsx) already clamps its own maxDate, but a
      // date picked before this render's maxDobDate was computed (or a
      // stale one carried in state) still deserves a real message here
      // rather than a silently-disabled Continue button.
      if (dateOfBirth && dateOfBirth > maxDobDate) {
        setError(`You need to be at least ${MIN_AGE_YEARS} to use Zen-Z.`);
        return;
      }

      // Previously this only surfaced as a cryptic FK error at final
      // submit, in handleCreateProfile — well past every other field, and
      // by then it read as the whole profile failing rather than one wrong
      // code. Checking right here, on the screen it's actually typed on,
      // catches it immediately instead.
      if (referralCode.trim()) {
        setIsLoading(true);
        setError('');
        const { data: isValid, error: validateError } = await supabase.rpc('validate_referral_code', {
          p_code: referralCode.trim(),
        });
        setIsLoading(false);

        if (validateError) {
          setError('Could not check that invite code — try again.');
          return;
        }
        if (!isValid) {
          setError("That invite code doesn't look right.");
          return;
        }
      }

      setStep(1);
      return;
    }

    if (!isValidPhone(phone.trim())) {
      setError('Enter a valid WhatsApp number.');
      return;
    }

    if (!photoUri) {
      setError('Add a photo before continuing.');
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
      // The calendar picks a local-midnight Date; toISOString() converts to
      // UTC first, which in IST (UTC+5:30) lands on the previous day and
      // stored every student's birthday one day early. Format the local
      // calendar date directly instead.
      const dobIso = [
        dateOfBirth.getFullYear(),
        String(dateOfBirth.getMonth() + 1).padStart(2, '0'),
        String(dateOfBirth.getDate()).padStart(2, '0'),
      ].join('-');

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
    <KeyboardAvoidingView
      style={[styles.root, { paddingBottom: 28 + insets.bottom }]}
      // 'height' on Android — react-native-screens' native screen container
      // isn't itself resized by the OS's own adjustResize, so without this
      // the keyboard just overlays the ScrollView below instead of shrinking
      // it to keep the focused field and the Continue button reachable. Same
      // fix as email-input.tsx/booking-flow.tsx/group/[groupId].tsx.
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{ width: contentWidth, flex: 1 }}>
        <View style={styles.header}>
          <FlowBackArrow onPress={handleBack} />
          <View style={{ flex: 1, marginLeft: 16 }}>
            <QuizProgressBar step={step} total={STEP_COUNT} />
          </View>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {step === 0 && (
            <StepShell title="Tell us about you">
              <View style={styles.group}>
                <Text style={FlowText.sectionLabel}>Name</Text>
                <FlowField
                  width={contentWidth}
                  placeholder="Your full name"
                  value={fullName}
                  onChangeText={setFullName}
                  editable={!isLoading}
                  autoFocus
                />
              </View>

              <View style={styles.group}>
                <Text style={FlowText.sectionLabel}>Date of birth</Text>
                <DobField
                  value={dateOfBirth}
                  onChange={(selected) => {
                    setDateOfBirth(selected);
                    setError('');
                  }}
                  maxDate={maxDobDate}
                  contentWidth={contentWidth}
                />
                <Text style={FlowText.fine}>We&apos;ll never show this to anyone else.</Text>
              </View>

              <View style={styles.group}>
                <Text style={FlowText.sectionLabel}>Year</Text>
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
              </View>

              <View style={styles.group}>
                <Text style={FlowText.sectionLabel}>How do you define yourself?</Text>
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
              </View>

              <View style={styles.group}>
                <Text style={FlowText.sectionLabel}>Have an invite code?</Text>
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
            <StepShell title="Last few things">
              <View style={styles.group}>
                <Text style={FlowText.sectionLabel}>WhatsApp number</Text>
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
                <Text style={FlowText.fine}>
                  Just your 10-digit number — no +91 needed. We&apos;ll use this to reach you about
                  event details.
                </Text>
              </View>

              <View style={styles.group}>
                <Text style={FlowText.sectionLabel}>Photo</Text>
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
              </View>
            </StepShell>
          )}

          {error ? (
            <Text style={[FlowText.error, styles.error]} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
        </ScrollView>

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
    </KeyboardAvoidingView>
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
  scrollContent: {
    paddingBottom: 24,
  },
  // No marginTop here: StepShell's own `gap: 28` already spaces one group
  // from the next (and from the title above them), so a group only needs
  // its own internal label-to-field gap.
  group: {
    gap: 14,
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
