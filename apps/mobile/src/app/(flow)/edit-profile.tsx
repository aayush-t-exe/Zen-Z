import { useEffect, useState } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
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
  const { width: screenWidth } = useWindowDimensions();
  const user = useAuthStore((state) => state.user);
  const contentWidth = Math.min(FLOW_CONTENT_MAX, screenWidth - FLOW_SIDE_PADDING * 2);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const [fullName, setFullName] = useState('');
  const [yearOfStudy, setYearOfStudy] = useState<number | null>(null);
  const [phone, setPhone] = useState('');

  // existingPhotoPath is the storage path already on file (used to know
  // whether there's anything to show before a new pick); photoUri/Base64
  // hold a freshly-picked replacement, which is only uploaded if the
  // student actually changes it — most edits won't touch the photo at all.
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('full_name, year_of_study, phone, photo_url')
        .eq('id', user.id)
        .single();

      if (fetchError || !profile) {
        setError('Could not load your profile');
        setIsLoading(false);
        return;
      }

      setFullName(profile.full_name ?? '');
      setYearOfStudy(profile.year_of_study ?? null);
      setPhone(profile.phone ?? '');

      if (profile.photo_url) {
        const { data } = await supabase.storage
          .from('profile-photos')
          .createSignedUrl(profile.photo_url, 3600);
        setExistingPhotoUrl(data?.signedUrl ?? null);
      }

      setIsLoading(false);
    };

    loadProfile();
  }, [user?.id]);

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
      }

      router.back();
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator color="#FFFDF8" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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

          {error ? <Text style={[FlowText.error, styles.error]}>{error}</Text> : null}

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
    </View>
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
