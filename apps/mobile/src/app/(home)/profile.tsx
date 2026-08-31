import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, ActivityIndicator, Platform, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FontFamily } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { fetchEmergencyContactPhone, fetchEmergencyContactPhoneBackup } from '@/lib/emergency';

const ANDROID_PACKAGE = 'com.campussocial.app';
const INSTAGRAM_HANDLE = 'zen_z.app';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const setSession = useAuthStore((state) => state.setSession);
  const setUser = useAuthStore((state) => state.setUser);

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(true);
  const [isDialing, setIsDialing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleRateApp = async () => {
    // [ASSUMPTION] Not yet listed on either store (per Milestone 20 — no
    // store enrollment until fully tested), so Android opens the Play
    // Store's listing page for our package (works pre-launch too, just
    // shows a "not found" page until the app is published) and iOS — where
    // we don't have an App Store ID yet — tells the student it's on the way
    // rather than opening a broken/unrelated link.
    if (Platform.OS === 'android') {
      const marketUrl = `market://details?id=${ANDROID_PACKAGE}`;
      const webUrl = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
      const canOpenMarket = await Linking.canOpenURL(marketUrl);
      await Linking.openURL(canOpenMarket ? marketUrl : webUrl);
      return;
    }
    Alert.alert('Coming soon', "We're not on the App Store just yet — hang tight.");
  };

  const handleDeleteAccount = () => {
    if (isDeleting) return;

    Alert.alert(
      'Delete your account?',
      "This permanently removes your profile info and photo. It can't be undone.",
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            // Goes through the delete-account Edge Function rather than
            // calling the delete_own_account RPC directly — the photo
            // cleanup step now has to happen as a real Storage API call
            // (Supabase blocks a raw SQL delete on storage.objects), and
            // this function is what sequences "scrub the account first,
            // then best-effort clean up the photo" correctly.
            const { error: functionError } = await supabase.functions.invoke('delete-account');
            setIsDeleting(false);

            if (functionError) {
              // supabase-js only gives a generic "non-2xx status" message
              // by default — the actual reason is in the response body,
              // on FunctionsHttpError's `context` (the raw Response).
              let message = functionError.message || 'Failed to delete account';
              const context = (functionError as any).context;
              if (context && typeof context.json === 'function') {
                try {
                  const body = await context.json();
                  if (body?.error) message = body.error;
                } catch {
                  // Body wasn't JSON — fall back to the generic message.
                }
              }

              if (message === 'ACTIVE_BOOKING') {
                Alert.alert(
                  'Not just yet',
                  "You've got a paid booking that's still pending or matched. Cancel it or message us first, then come back to delete your account."
                );
                return;
              }
              Alert.alert('Could not delete account', message);
              return;
            }

            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            router.replace('/(auth)/onboarding');
          },
        },
      ]
    );
  };

  const handleFollowInstagram = async () => {
    const appUrl = `instagram://user?username=${INSTAGRAM_HANDLE}`;
    const webUrl = `https://www.instagram.com/${INSTAGRAM_HANDLE}`;
    const canOpenApp = await Linking.canOpenURL(appUrl);
    await Linking.openURL(canOpenApp ? appUrl : webUrl);
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
        </View>

        <View style={{ marginTop: 24, gap: 10 }}>
          <Text style={styles.sectionLabel}>Zen-Z</Text>

          <Pressable onPress={() => router.push('/(flow)/invite')} style={styles.actionCard}>
            <Text style={styles.actionLabel}>Invite a friend</Text>
          </Pressable>

          <Pressable onPress={handleRateApp} style={styles.actionCard}>
            <Text style={styles.actionLabel}>Rate the app</Text>
          </Pressable>

          <Pressable onPress={handleFollowInstagram} style={styles.actionCard}>
            <Text style={styles.actionLabel}>Follow us on Instagram</Text>
          </Pressable>
        </View>

        <View style={{ marginTop: 24, gap: 10 }}>
          <Pressable onPress={handleSignOut} style={[styles.actionCard, styles.signOutCard]}>
            <Text style={[styles.actionLabel, styles.signOutLabel]}>Sign Out</Text>
          </Pressable>

          <Pressable
            onPress={handleDeleteAccount}
            disabled={isDeleting}
            style={[styles.actionCard, styles.signOutCard, isDeleting && { opacity: 0.6 }]}
          >
            <Text style={[styles.actionLabel, styles.signOutLabel]}>
              {isDeleting ? 'Deleting…' : 'Delete Account'}
            </Text>
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
    fontFamily: FontFamily.display.bold,
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
    fontFamily: FontFamily.body.bold,
  },
  fieldValue: {
    color: Palette.muted,
    fontSize: 14,
    fontFamily: FontFamily.body.regular,
  },
  sectionLabel: {
    color: Palette.muted,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FontFamily.body.bold,
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
    fontFamily: FontFamily.body.bold,
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
    fontFamily: FontFamily.body.regular,
    marginTop: 32,
  },
});
