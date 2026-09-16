import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import {
  FLOW_CONTENT_MAX,
  FLOW_SIDE_PADDING,
  FlowSurface,
  FlowText,
} from '@/constants/flow-theme';
import { FlowBackArrow } from '@/components/flow-back-button';
import { FlowField, FlowPanel } from '@/components/flow-panel';
import { FlowPillButton } from '@/components/flow-pill-button';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import {
  fetchProfileFields,
  fetchSignedPhotoUrl,
  profileFieldsKey,
  profilePhotoKey,
} from '@/lib/profile';

// Mirrors profile-creation.tsx's own YEARS/validation exactly — same
// stored representation (1-5 int), same WhatsApp number format. Gender is
// deliberately left out here: it's a hard matching filter
// (women_only/men_only, see MatchingBoard.tsx's requiredGenderForGroup),
// and letting a student flip it freely would make it trivial to game entry
// into a gender-restricted group in a way lying once at signup doesn't —
// founder decision, no self-serve edit for it.
const YEARS: { label: string; value: number }[] = [
  { label: '1st year', value: 1 },
  { label: '2nd year', value: 2 },
  { label: '3rd year', value: 3 },
  { label: '4th year', value: 4 },
  { label: 'Other', value: 5 },
];

const PHONE_PATTERN = /^\d{10}$/;
function isValidPhone(value: string): boolean {
  return PHONE_PATTERN.test(value);
}
function isValidName(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && !/\d/.test(trimmed);
}

export default function EditProfileScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { width: screenWidth } = useWindowDimensions();
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const contentWidth = Math.min(FLOW_CONTENT_MAX, screenWidth - FLOW_SIDE_PADDING * 2);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const [fullName, setFullName] = useState('');
  const [yearOfStudy, setYearOfStudy] = useState<number | null>(null);
  const [phone, setPhone] = useState('');

  // existingPhotoPath is the storage path already on file (used to know
  // whether there's anything to show before a new pick); photoUri/Base64
  // hold a freshly-picked replacement, which is only uploaded if the
  // student actually changes it — most edits won't touch the photo at all.
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);

  const userId = user?.id;

  // Same cache profile.tsx reads/writes — arriving here from that tab
  // usually means this data is already warm, so the form can render
  // instantly instead of showing its own separate loading spinner.
  const {
    data: profile,
    isLoading: isProfileLoading,
    isError: isProfileError,
  } = useQuery({
    queryKey: profileFieldsKey(userId ?? ''),
    queryFn: () => fetchProfileFields(userId!),
    enabled: !!userId,
  });

  const existingPhotoPath = profile?.photo_url ?? null;

  const { data: existingPhotoUrl } = useQuery({
    queryKey: profilePhotoKey(existingPhotoPath ?? ''),
    queryFn: () => fetchSignedPhotoUrl(existingPhotoPath!),
    enabled: !!existingPhotoPath,
    staleTime: 50 * 60 * 1000,
  });

  const isLoading = isProfileLoading;
  const seededRef = useRef(false);

  // The values the form was seeded with, so isDirty below can tell an
  // actual edit apart from the initial fetch just landing.
  const [initialValues, setInitialValues] = useState<{
    fullName: string;
    yearOfStudy: number | null;
    phone: string;
  } | null>(null);

  // Seeds the editable fields once, the first time the cached/fetched
  // profile actually arrives — not on every render, so it doesn't clobber
  // an in-progress edit if this query happens to refetch in the background
  // while the student is still typing.
  useEffect(() => {
    if (!profile || seededRef.current) return;
    seededRef.current = true;
    const seeded = {
      fullName: profile.full_name ?? '',
      yearOfStudy: profile.year_of_study ?? null,
      phone: profile.phone ?? '',
    };
    setFullName(seeded.fullName);
    setYearOfStudy(seeded.yearOfStudy);
    setPhone(seeded.phone);
    setInitialValues(seeded);
  }, [profile]);

  const isDirty =
    !!initialValues &&
    (fullName !== initialValues.fullName ||
      yearOfStudy !== initialValues.yearOfStudy ||
      phone !== initialValues.phone ||
      photoUri !== null);

  // Set right before any router.back() this screen triggers itself
  // (a successful save, or "Discard" inside the confirm below) so that
  // follow-up doesn't re-trigger the same guard on its own way out.
  const bypassLeaveGuardRef = useRef(false);

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
      setPhotoUri(result.assets[0].uri);
      setPhotoBase64(result.assets[0].base64 ?? null);
      setError('');
    }
  };

  const canSave = isValidName(fullName) && yearOfStudy !== null && isValidPhone(phone.trim());

  const handleSave = async () => {
    if (!user) return;
    if (!isValidName(fullName)) {
      setError('Enter your full name without any numbers.');
      return;
    }
    if (yearOfStudy === null) {
      setError('Select your year.');
      return;
    }
    if (!isValidPhone(phone.trim())) {
      setError('Enter a valid WhatsApp number.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          year_of_study: yearOfStudy,
          phone: phone.trim(),
        })
        .eq('id', user.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      let uploadedPhotoPath: string | null = null;

      if (photoUri && photoBase64) {
        // Same fixed path/upsert pattern as profile-creation.tsx — the
        // storage UPDATE policy for this exact path (0038_profile_photo_
        // update_policy.sql) is what lets a repeat upload overwrite the
        // old file instead of failing.
        const fileName = `${user.id}/profile.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('profile-photos')
          .upload(fileName, decode(photoBase64), { contentType: 'image/jpeg', upsert: true });

        if (uploadError) {
          setError('Failed to upload photo');
          return;
        }

        await supabase.from('profiles').update({ photo_url: fileName }).eq('id', user.id);
        uploadedPhotoPath = fileName;
      }

      // Updates the cache profile.tsx reads directly, so it shows the new
      // values the instant you navigate back, and invalidates the photo
      // query too — the storage path is a fixed per-user file, so a
      // re-upload needs a fresh signed URL (a new token) or the <Image>
      // there would keep the old cached bytes under the unchanged path.
      queryClient.setQueryData(profileFieldsKey(user.id), (old: typeof profile) => ({
        ...(old ?? { photo_url: null, gender: null }),
        full_name: fullName.trim(),
        year_of_study: yearOfStudy,
        phone: phone.trim(),
        photo_url: uploadedPhotoPath ?? old?.photo_url ?? null,
      }));
      if (uploadedPhotoPath) {
        queryClient.invalidateQueries({ queryKey: profilePhotoKey(uploadedPhotoPath) });
      }
      // Reconciles with the server in the background (profile.tsx's own
      // query observer is what's mounted at this point) — the setQueryData
      // above already made the just-saved values visible immediately, this
      // just confirms them rather than trusting the client-side merge
      // indefinitely.
      queryClient.invalidateQueries({ queryKey: profileFieldsKey(user.id) });

      // A save just went through, so the beforeRemove guard above would
      // otherwise catch this very router.back() — the state still reads
      // as dirty against initialValuesRef, which was never updated to the
      // now-saved values.
      bypassLeaveGuardRef.current = true;
      router.back();
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  // beforeRemove fires for every way this screen can be left — the header
  // back arrow, Android's hardware back button, and the iOS swipe-back
  // gesture — since they all resolve to the same navigator "go back"
  // action under the hood. Catching it here means there's one guard
  // instead of three separate ones to keep in sync.
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!isDirty || bypassLeaveGuardRef.current) return;
      e.preventDefault();

      const buttons: any[] = [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: "Don't save",
          style: 'destructive',
          onPress: () => {
            bypassLeaveGuardRef.current = true;
            navigation.dispatch(e.data.action);
          },
        },
      ];
      if (canSave) {
        buttons.push({ text: 'Save', onPress: () => handleSave() });
      }

      Alert.alert(
        'Save your changes?',
        "You've edited your profile but haven't saved yet.",
        buttons
      );
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, isDirty, canSave]);

  if (isLoading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator color="#FFFDF8" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      // 'height' on Android, same fix as email-input.tsx/booking-flow.tsx/
      // group/[groupId].tsx — without it the keyboard just overlays the
      // WhatsApp field at the bottom of this form instead of pushing the
      // ScrollView content up so it stays reachable.
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={{ width: contentWidth }}>
          <View style={styles.header}>
            <FlowBackArrow onPress={() => router.back()} />
          </View>
          <Text style={FlowText.title}>Edit Profile</Text>

          <Pressable
            onPress={handlePickImage}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel="Change photo"
            style={styles.photoWrap}>
            {photoUri || existingPhotoUrl ? (
              <Image
                source={{ uri: photoUri ?? existingPhotoUrl ?? undefined }}
                style={styles.photo}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View style={styles.photo}>
                <Text style={FlowText.panelLabel}>Upload</Text>
              </View>
            )}
            <Text style={[FlowText.fine, styles.changePhotoLabel]}>Tap to change photo</Text>
          </Pressable>

          <View style={styles.group}>
            <Text style={FlowText.sectionLabel}>Name</Text>
            <FlowField
              width={contentWidth}
              value={fullName}
              onChangeText={setFullName}
              editable={!isSaving}
              placeholder="Your full name"
            />
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
                  onPress={() => !isSaving && setYearOfStudy(year.value)}
                />
              ))}
            </View>
          </View>

          <View style={styles.group}>
            <Text style={FlowText.sectionLabel}>WhatsApp number</Text>
            <FlowField
              width={contentWidth}
              value={phone}
              onChangeText={(text) => setPhone(text.replace(/\D/g, '').slice(0, 10))}
              editable={!isSaving}
              keyboardType="number-pad"
              maxLength={10}
              placeholder="9XXXXXXXXX"
            />
          </View>

          {error || isProfileError ? (
            <Text style={[FlowText.error, styles.error]}>
              {error || 'Could not load your profile'}
            </Text>
          ) : null}

          <View style={{ marginTop: 36 }}>
            <FlowPillButton
              label="Save changes"
              width={contentWidth}
              onPress={handleSave}
              loading={isSaving}
              disabled={!canSave}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 48,
  },
  header: {
    marginBottom: 24,
  },
  photoWrap: {
    alignItems: 'center',
    marginTop: 20,
  },
  photo: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 1,
    borderColor: FlowSurface.stroke,
    backgroundColor: FlowSurface.fill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  changePhotoLabel: {
    marginTop: 10,
  },
  group: {
    marginTop: 32,
    gap: 14,
  },
  error: {
    marginTop: 20,
  },
});
