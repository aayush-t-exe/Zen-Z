import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  ActivityIndicator,
  Platform,
  Alert,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import {
  FLOW_CONTENT_MAX,
  FLOW_SIDE_PADDING,
  FlowSurface,
  FlowText,
} from '@/constants/flow-theme';
import { FlowActionRow, FlowSurfaceBox } from '@/components/flow-panel';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { fetchEmergencyContactPhone, fetchEmergencyContactPhoneBackup } from '@/lib/emergency';

const ANDROID_PACKAGE = 'com.campussocial.app';
const INSTAGRAM_HANDLE = 'zen_z.app';

// Mirrors profile-creation.tsx's YEARS options — year_of_study is stored as
// this same 1-5 int, so display just reverses that mapping.
const YEAR_LABELS: Record<number, string> = {
  1: '1st year',
  2: '2nd year',
  3: '3rd year',
  4: '4th year',
  5: 'Other',
};

function formatYear(value: number | null): string {
  if (value === null) return 'Not set';
  return YEAR_LABELS[value] ?? 'Not set';
}

// profiles.gender is stored snake_case ('prefer_not_to_say') per the
// profiles_gender_check constraint — this just reverses that formatting,
// not a separate source of truth for the allowed values.
function formatGender(value: string | null): string {
  if (!value) return 'Not set';
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export default function ProfileScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const user = useAuthStore((state) => state.user);
  const setSession = useAuthStore((state) => state.setSession);
  const setUser = useAuthStore((state) => state.setUser);

  // Same content column the rest of the redesign runs.
  const contentWidth = Math.min(FLOW_CONTENT_MAX, screenWidth - FLOW_SIDE_PADDING * 2);

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(true);
  const [isDialing, setIsDialing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [fullName, setFullName] = useState<string | null>(null);
  const [yearOfStudy, setYearOfStudy] = useState<number | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) {
        setPhotoLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('photo_url, full_name, year_of_study, gender, phone')
        .eq('id', user.id)
        .single();

      setFullName(profile?.full_name ?? null);
      setYearOfStudy(profile?.year_of_study ?? null);
      setGender(profile?.gender ?? null);
      setPhone(profile?.phone ?? null);

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

    loadProfile();
  }, [user?.id]);

  const dialEmergencyContact = async (fetchPhone: () => Promise<string | null>) => {
    if (isDialing) return;
    setIsDialing(true);

    try {
      const phone = await fetchPhone();
      if (!phone) {
        // A silent no-op here is not acceptable for an emergency button —
        // someone tapping this needs to know right away to reach out
        // another way, not wonder why nothing happened.
        Alert.alert(
          "Couldn't reach this number",
          "We couldn't load the emergency contact right now. If this is urgent, please call local emergency services directly."
        );
        return;
      }
      await Linking.openURL(`tel:${phone}`);
    } catch (err) {
      console.error('Failed to open dialer:', err);
      Alert.alert(
        "Couldn't open the dialer",
        'If this is urgent, please call local emergency services directly.'
      );
    } finally {
      setIsDialing(false);
    }
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
        <View style={{ width: contentWidth }}>
          <Text style={FlowText.title}>Your Profile</Text>

          <View style={styles.photoWrap}>
            {photoLoading ? (
              <View style={styles.photo}>
                <ActivityIndicator color="#FFFDF8" />
              </View>
            ) : photoUrl ? (
              <Image
                source={{ uri: photoUrl }}
                style={styles.photo}
                accessibilityIgnoresInvertColors
              />
            ) : (
              // No photo on file. Left as a plain empty well rather than an
              // icon or an "add a photo" prompt: photos are collected once
              // at profile creation and only ever seen by the founder's
              // team, so there is nothing for a student to do here.
              <View style={styles.photo} />
            )}
          </View>

          <View style={styles.group}>
            <Text style={FlowText.sectionLabel}>About You</Text>
            <FlowSurfaceBox width={contentWidth}>
              <View style={styles.rowContent}>
                <Text style={FlowText.panelLabel}>{fullName || 'Not set'}</Text>
              </View>
            </FlowSurfaceBox>
            <FlowSurfaceBox width={contentWidth}>
              <View style={styles.rowContent}>
                <Text style={FlowText.panelLabel}>{formatYear(yearOfStudy)}</Text>
              </View>
            </FlowSurfaceBox>
            <FlowSurfaceBox width={contentWidth}>
              <View style={styles.rowContent}>
                <Text style={FlowText.panelLabel}>{formatGender(gender)}</Text>
              </View>
            </FlowSurfaceBox>
            <FlowSurfaceBox width={contentWidth}>
              <View style={styles.rowContent}>
                <Text style={FlowText.panelLabel}>{phone || 'Not set'}</Text>
              </View>
            </FlowSurfaceBox>
          </View>

          <View style={styles.group}>
            <Text style={FlowText.sectionLabel}>Email</Text>
            <FlowSurfaceBox width={contentWidth}>
              <View style={styles.rowContent}>
                <Text style={FlowText.panelLabel}>{user?.email || 'Not set'}</Text>
              </View>
            </FlowSurfaceBox>
          </View>

          <View style={styles.group}>
            <Text style={FlowText.sectionLabel}>Account</Text>
            <FlowActionRow
              label="Need help now"
              width={contentWidth}
              disabled={isDialing}
              icon={require('@/assets/images/icon-call.png')}
              onPress={() => dialEmergencyContact(fetchEmergencyContactPhone)}
            />
            <FlowActionRow
              label="Need help now (backup)"
              width={contentWidth}
              disabled={isDialing}
              icon={require('@/assets/images/icon-call.png')}
              onPress={() => dialEmergencyContact(fetchEmergencyContactPhoneBackup)}
            />
          </View>

          <View style={styles.group}>
            <Text style={FlowText.sectionLabel}>Zen-Z</Text>
            <FlowActionRow
              label="Invite a friend"
              width={contentWidth}
              onPress={() => router.push('/(flow)/invite')}
            />
            <FlowActionRow label="Rate the app" width={contentWidth} onPress={handleRateApp} />
            <FlowActionRow
              label="Follow us on Instagram"
              width={contentWidth}
              onPress={handleFollowInstagram}
            />
          </View>

          <View style={styles.group}>
            <Text style={FlowText.sectionLabel}>Legal</Text>
            <FlowActionRow
              label="Terms & Conditions"
              width={contentWidth}
              onPress={() => Linking.openURL('https://zen-z.site/terms')}
            />
            <FlowActionRow
              label="Privacy Policy"
              width={contentWidth}
              onPress={() => Linking.openURL('https://zen-z.site/privacy')}
            />
            <FlowActionRow
              label="Cancellation & Refund Policy"
              width={contentWidth}
              onPress={() => Linking.openURL('https://zen-z.site/refund')}
            />
          </View>

          <View style={styles.group}>
            <FlowActionRow
              label="Sign Out"
              width={contentWidth}
              tone="danger"
              onPress={handleSignOut}
            />
            <FlowActionRow
              label={isDeleting ? 'Deleting…' : 'Delete Account'}
              width={contentWidth}
              tone="danger"
              disabled={isDeleting}
              onPress={handleDeleteAccount}
            />
          </View>

          <Text style={[FlowText.fine, styles.versionText]}>App Version: 1.0.0</Text>
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
  scroll: {
    alignItems: 'center',
    paddingTop: 56,
    // The floating pill tab bar (home/_layout.tsx) is position: 'absolute',
    // so this screen has to reserve the space itself (bar height 66 + its own
    // 33 bottom offset, plus breathing room) or the last row sits under it.
    // Same allowance the Home screen makes.
    paddingBottom: 116,
  },
  photoWrap: {
    alignItems: 'center',
    marginTop: 28,
  },
  // Coded rather than drawn from the row art: stretching a 902x154 box into a
  // circle distorts its corners. Matched to the art's fill and stroke by
  // value — see FlowSurface.
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
  group: {
    marginTop: 32,
    gap: 14,
  },
  // In flow rather than absolute, matching FlowActionRow, so a long address
  // wraps and takes the row with it instead of being clipped.
  rowContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  versionText: {
    marginTop: 36,
    textAlign: 'center',
  },
});
