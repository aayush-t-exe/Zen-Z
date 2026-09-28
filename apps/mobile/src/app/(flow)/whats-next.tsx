import { useState } from 'react';
import { View, Text, ScrollView, Image, StyleSheet, useWindowDimensions } from 'react-native';
import { showAlert } from '@/lib/alert';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FLOW_CONTENT_MAX, FLOW_SIDE_PADDING, FlowText } from '@/constants/flow-theme';
import { ACTIVITY_ART_BADGE_SCALE, activityArt } from '@/constants/activity-art';
import { FlowPillButton } from '@/components/flow-pill-button';
import { SummaryBadge } from '@/components/summary-card';
import { formatSlotDateTime } from '@/lib/format';
import { buildWhatsappUrl, fetchSupportWhatsappPhone } from '@/lib/support';
import { fetchProfileFields } from '@/lib/profile';
import { useAuthStore } from '@/store/auth';

/** The comp's own tick (payment.tsx's IncludedLine uses the same one), standing in for a list bullet. */
const TICK = require('@/assets/images/icon-tick.png');
/** icon-tick.png is 42x31. */
const TICK_ASPECT = 31 / 42;

const STEPS = [
  {
    label: "We hand-match you into a group of 4–5, by personality.",
    detail: 'No browsing, no swiping — you’ll know the moment it happens.',
  },
  {
    label: '48 hours before, your venue unlocks.',
    detail: 'The group chat opens too — say hello before you meet.',
  },
  {
    label: 'Show up and meet your table.',
    detail: undefined as string | undefined,
  },
  {
    label: "We'll ask how it went.",
    detail: undefined as string | undefined,
  },
];

function StepRow({ label, detail }: { label: string; detail?: string }) {
  return (
    <View style={styles.stepRow}>
      <Image source={TICK} style={styles.stepTick} resizeMode="contain" accessibilityIgnoresInvertColors />
      <View style={{ flex: 1 }}>
        <Text style={styles.stepLabel}>{label}</Text>
        {detail && <Text style={styles.stepDetail}>{detail}</Text>}
      </View>
    </View>
  );
}

export default function WhatsNextScreen() {
  const router = useRouter();
  const { activityName, slotDatetime } = useLocalSearchParams<{
    activityName?: string;
    slotDatetime?: string;
  }>();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const contentWidth = Math.min(FLOW_CONTENT_MAX, screenWidth - FLOW_SIDE_PADDING * 2);

  const [isContactingSupport, setIsContactingSupport] = useState(false);
  const userId = useAuthStore((state) => state.user?.id);

  const handleContactSupport = async () => {
    if (isContactingSupport) return;
    setIsContactingSupport(true);

    try {
      const phone = await fetchSupportWhatsappPhone();
      if (!phone) {
        showAlert("Couldn't open WhatsApp", 'Please try again in a moment.');
        return;
      }
      // This DM lands straight in the founder's own WhatsApp, so naming the
      // student here (not just the slot) is what lets them reply without
      // first digging through the admin dashboard to match a booking. A
      // failed name lookup shouldn't block the message going out at all.
      const name = userId ? await fetchProfileFields(userId).then((p) => p.full_name, () => null) : null;
      const message = `Hi, I'm ${name ?? 'a student'} and I can't make it to ${activityName ?? 'my booking'}${
        slotDatetime ? ` (${formatSlotDateTime(slotDatetime, activityName)})` : ''
      } — can you help?`;
      await Linking.openURL(buildWhatsappUrl(phone, message));
    } catch (err) {
      console.error('Failed to open WhatsApp:', err);
      showAlert("Couldn't open WhatsApp", 'Please try again in a moment.');
    } finally {
      setIsContactingSupport(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 56 + insets.bottom }]}
        showsVerticalScrollIndicator={false}>
        <View style={{ width: contentWidth, alignItems: 'center' }}>
          {activityName && (
            <View style={{ marginBottom: 18 }}>
              <SummaryBadge
                cardWidth={contentWidth}
                icon={{ source: activityArt(activityName), scale: ACTIVITY_ART_BADGE_SCALE }}
              />
            </View>
          )}

          <Text style={FlowText.titleCentred}>You&apos;re in.</Text>
          {activityName && slotDatetime && (
            <Text style={[styles.centredSubtitle, { marginTop: 8 }]}>
              {activityName}, {formatSlotDateTime(slotDatetime, activityName)}
            </Text>
          )}

          <Text style={[FlowText.sectionLabel, styles.sectionLabel]}>What happens next</Text>

          <View style={{ width: '100%', gap: 20 }}>
            {STEPS.map((step) => (
              <StepRow key={step.label} label={step.label} detail={step.detail} />
            ))}
          </View>

          <Text style={styles.noShowNote}>
            Miss it without letting us know and it counts as a no-show — three in a row pauses new
            invitations for a week.
          </Text>

          <FlowPillButton
            label="Back to home  →"
            width={contentWidth}
            onPress={() => router.push('/(home)')}
            style={{ marginTop: 28 }}
          />

          <Text
            onPress={handleContactSupport}
            style={[FlowText.link, styles.contactLink]}
            accessibilityRole="button"
          >
            {isContactingSupport ? 'Opening WhatsApp…' : "Can't make it? Message us on WhatsApp"}
          </Text>
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
    paddingHorizontal: 24,
  },
  centredSubtitle: {
    ...FlowText.subtitle,
    textAlign: 'center',
  },
  sectionLabel: {
    alignSelf: 'flex-start',
    marginTop: 40,
    marginBottom: 18,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepTick: {
    width: 15,
    height: 15 * TICK_ASPECT,
    marginTop: 3,
  },
  stepLabel: {
    ...FlowText.rowLabel,
  },
  stepDetail: {
    ...FlowText.fine,
    marginTop: 3,
  },
  noShowNote: {
    ...FlowText.fine,
    textAlign: 'center',
    marginTop: 32,
  },
  contactLink: {
    marginTop: 20,
    textAlign: 'center',
  },
});
