import { useCallback, useState } from 'react';
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
import { useRouter, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { buildWhatsappUrl, fetchSupportEmail, fetchSupportWhatsappPhone } from '@/lib/support';
import {
  fetchProfileFields,
  fetchSignedPhotoUrl,
  profileFieldsKey,
  profilePhotoKey,
} from '@/lib/profile';

const ANDROID_PACKAGE = 'com.campussocial.app';
const INSTAGRAM_HANDLE = 'zen_z.app';
/** Comfortably inside the storage-signed URL's 3600s expiry (see lib/profile.ts). */
const PHOTO_URL_REFRESH_MS = 50 * 60 * 1000;

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
  const queryClient = useQueryClient();

  // Same content column the rest of the redesign runs.
  const contentWidth = Math.min(FLOW_CONTENT_MAX, screenWidth - FLOW_SIDE_PADDING * 2);

  const [isDialing, setIsDialing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isContactingSupport, setIsContactingSupport] = useState(false);

  const userId = user?.id;

  // Cached rather than local useState + a fetch-on-focus effect — this
  // screen's tab stays mounted between visits, so a plain state fetch used
  // to hit Postgres and re-sign the photo URL on every single tab switch.
  // edit-profile.tsx invalidates this same key on save, so this only
  // actually refetches when there's something new to show, not on every
  // focus.
  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: profileFieldsKey(userId ?? ''),
    queryFn: () => fetchProfileFields(userId!),
    enabled: !!userId,
  });

  const photoPath = profile?.photo_url ?? null;

  // Split out from the fields query and keyed by the photo's storage path,
  // not by focus/time — createSignedUrl mints a new token every call, and
  // feeding <Image> a new uri each focus was what made the photo visibly
  // re-download/flash every time you switched back to this tab. This only
  // re-runs when the photo path actually changes, or (refetchInterval)
  // shortly before the signed URL's own 3600s expiry.
  const { data: photoUrl } = useQuery({
    queryKey: profilePhotoKey(photoPath ?? ''),
    queryFn: () => fetchSignedPhotoUrl(photoPath!),
    enabled: !!photoPath,
    staleTime: PHOTO_URL_REFRESH_MS,
    refetchInterval: PHOTO_URL_REFRESH_MS,
  });

  const photoLoading = !profile || (!!photoPath && photoUrl === undefined);

  // Still worth a refetch on focus (e.g. coming back from edit-profile.tsx
  // without a network round trip in between) — cheap now that it's a
  // background refresh behind cached data rather than a blank/spinner
  // reset every time.
  useFocusEffect(
    useCallback(() => {
      if (userId) refetchProfile();
    }, [userId, refetchProfile])
  );

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

  // "Need help now" above dials for an in-progress meetup emergency —
  // this is the everyday "something's wrong with the app/my booking"
  // channel, so it opens a WhatsApp chat rather than the dialer (async,
  // lets the student attach a screenshot). Falls back to the support
  // email if the WhatsApp number can't be loaded.
  const handleContactSupport = async () => {
    if (isContactingSupport) return;
    setIsContactingSupport(true);

    try {
      const phone = await fetchSupportWhatsappPhone();
      if (!phone) {
        const email = await fetchSupportEmail();
        Alert.alert(
          "Couldn't open WhatsApp",
          email
            ? `Please email us at ${email} instead.`
            : "We couldn't load our contact details right now. Please try again in a moment."
        );
        return;
      }
      await Linking.openURL(buildWhatsappUrl(phone, 'Hi, I need some help with my Zen-Z account.'));
    } catch (err) {
      console.error('Failed to open WhatsApp:', err);
      Alert.alert("Couldn't open WhatsApp", 'Please try again in a moment.');
    } finally {
      setIsContactingSupport(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      queryClient.clear();
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
            queryClient.clear();
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
                <Text style={FlowText.panelLabel}>{profile?.full_name || 'Not set'}</Text>
              </View>
            </FlowSurfaceBox>
            <FlowSurfaceBox width={contentWidth}>
              <View style={styles.rowContent}>
                <Text style={FlowText.panelLabel}>{formatYear(profile?.year_of_study ?? null)}</Text>
              </View>
            </FlowSurfaceBox>
            <FlowSurfaceBox width={contentWidth}>
              <View style={styles.rowContent}>
                <Text style={FlowText.panelLabel}>{formatGender(profile?.gender ?? null)}</Text>
              </View>
            </FlowSurfaceBox>
            <FlowSurfaceBox width={contentWidth}>
              <View style={styles.rowContent}>
                <Text style={FlowText.panelLabel}>{profile?.phone || 'Not set'}</Text>
              </View>
            </FlowSurfaceBox>
            {/* Gender has no edit row here on purpose — it's a hard
                matching filter (women_only/men_only), so it stays founder-
                only to change, not something a student can flip themselves. */}
            <FlowActionRow
              label="Edit Profile"
              width={contentWidth}
              onPress={() => router.push('/(flow)/edit-profile')}
            />
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
            {/* For everyday issues (a booking, a payment) rather than an
                in-progress meetup emergency — the two rows above are for that. */}
            <FlowActionRow
              label={isContactingSupport ? 'Opening WhatsApp…' : 'Contact Support'}
              width={contentWidth}
              disabled={isContactingSupport}
              icon={require('@/assets/images/icon-call.png')}
              onPress={handleContactSupport}
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
