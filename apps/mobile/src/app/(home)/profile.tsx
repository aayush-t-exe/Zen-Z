import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { fetchEmergencyContactPhone, fetchEmergencyContactPhoneBackup } from '@/lib/emergency';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const setSession = useAuthStore((state) => state.setSession);
  const setUser = useAuthStore((state) => state.setUser);

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(true);
  const [isDialing, setIsDialing] = useState(false);

  useEffect(() => {
    const loadPhoto = async () => {
      if (!user?.id) {
        setPhotoLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('photo_url')
        .eq('id', user.id)
        .single();

      // profiles.photo_url is a storage path, not a usable URL — the
      // bucket is private, so it has to be exchanged for a signed URL.
      // The "self read own photo" RLS policy is what makes this succeed
      // for a student's own path (and only their own).
      if (profile?.photo_url) {
        const { data } = await supabase.storage
          .from('profile-photos')
          .createSignedUrl(profile.photo_url, 3600);
        setPhotoUrl(data?.signedUrl ?? null);
      }

      setPhotoLoading(false);
    };

    loadPhoto();
  }, [user?.id]);

  const dialEmergencyContact = async (fetchPhone: () => Promise<string | null>) => {
    if (isDialing) return;
    setIsDialing(true);

    const phone = await fetchPhone();
    if (phone) {
      await Linking.openURL(`tel:${phone}`);
    }

    setIsDialing(false);
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      router.replace('/(auth)/onboarding');
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Your Profile</Text>

        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          {photoLoading ? (
            <View style={styles.photo}>
              <ActivityIndicator color={Palette.text} />
            </View>
          ) : photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.photo} />
          ) : (
            <View style={styles.photo}>
              <Text style={{ fontSize: 28 }}>📷</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Email</Text>
          <Text style={styles.fieldValue}>{user?.email || 'Not set'}</Text>
        </View>

        <View style={{ marginTop: 24, gap: 10 }}>
          <Text style={styles.sectionLabel}>Account</Text>

          <Pressable
            onPress={() => dialEmergencyContact(fetchEmergencyContactPhone)}
            disabled={isDialing}
            style={styles.actionCard}
          >
            <Text style={styles.actionLabel}>Need help now</Text>
          </Pressable>

          <Pressable
            onPress={() => dialEmergencyContact(fetchEmergencyContactPhoneBackup)}
            disabled={isDialing}
            style={styles.actionCard}
          >
            <Text style={styles.actionLabel}>Need help now (backup)</Text>
          </Pressable>

          <Pressable onPress={handleSignOut} style={[styles.actionCard, styles.signOutCard]}>
            <Text style={[styles.actionLabel, styles.signOutLabel]}>Sign Out</Text>
          </Pressable>
        </View>

        <Text style={styles.versionText}>App Version: 1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Palette.canvas,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  pageTitle: {
    color: Palette.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 24,
  },
  photo: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2.5,
    borderColor: Palette.ring,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderWidth: 2.5,
    borderColor: Palette.ring,
    borderRadius: 20,
    padding: 16,
    gap: 4,
  },
  fieldLabel: {
    color: Palette.text,
    fontSize: 15,
    fontWeight: '700',
  },
  fieldValue: {
    color: Palette.muted,
    fontSize: 14,
  },
  sectionLabel: {
    color: Palette.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionCard: {
    borderWidth: 2.5,
    borderColor: Palette.ring,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  actionLabel: {
    color: Palette.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  signOutCard: {
    borderColor: Palette.error,
  },
  signOutLabel: {
    color: Palette.error,
  },
  versionText: {
    color: Palette.muted,
    fontSize: 12,
    marginTop: 32,
  },
});
