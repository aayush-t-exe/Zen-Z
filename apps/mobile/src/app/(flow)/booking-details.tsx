import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Linking,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FLOW_CONTENT_MAX, FLOW_SIDE_PADDING, FlowText } from '@/constants/flow-theme';
import { ACTIVITY_ART_BADGE_SCALE, activityArt } from '@/constants/activity-art';
import { FlowSurfaceBox } from '@/components/flow-panel';
import { FlowPillButton } from '@/components/flow-pill-button';
import { FlowBackButton } from '@/components/flow-back-button';
import { SummaryBadge } from '@/components/summary-card';
import { fetchMyGroups, fetchGroupMembers, MyGroupDetails, GroupMember } from '@/lib/groups';
import { formatSlotDateTime, formatSlotDay, formatEventTime } from '@/lib/format';

/** Matches the primary pill's near-white, as the other redesigned screens set it. */
const LOADER = '#FFFDF8';

/** A labelled value on the flow's row surface — the profile tab's own pattern. */
function DetailRow({
  label,
  value,
  detail,
  width,
  art,
  onPress,
  actionLabel,
}: {
  label: string;
  value: string;
  detail?: string | null;
  width: number;
  /** Activity name, when the row should carry that activity's render. */
  art?: string;
  /** When set, the row becomes tappable (e.g. opening the venue in Maps). */
  onPress?: () => void;
  /** Shown under `detail` only when `onPress` is set. */
  actionLabel?: string;
}) {
  return (
    <View style={{ gap: 14 }}>
      <Text style={FlowText.sectionLabel}>{label}</Text>
      <FlowSurfaceBox width={width}>
        <Pressable style={styles.rowContent} onPress={onPress} disabled={!onPress}>
          {art ? (
            <SummaryBadge
              cardWidth={width}
              icon={{ source: activityArt(art), scale: ACTIVITY_ART_BADGE_SCALE }}
            />
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={FlowText.panelLabel}>{value}</Text>
            {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
            {onPress && actionLabel ? <Text style={styles.rowLink}>{actionLabel}</Text> : null}
          </View>
        </Pressable>
      </FlowSurfaceBox>
    </View>
  );
}

// The "Booking" counterpart to the group Chat screen — same underlying
// data (fetchMyGroups/fetchGroupMembers, the same reveal gate), just a
// dedicated place to see venue/address/member details without opening the
// message thread. Deliberately re-fetches independently rather than
// receiving group/members as nav params, so is_revealed is always this
// screen's own fresh read of the server, never a stale value carried over
// from whenever the Bookings tab last loaded.
export default function BookingDetailsScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();

  // Same content column the rest of the redesign runs.
  const contentWidth = Math.min(FLOW_CONTENT_MAX, screenWidth - FLOW_SIDE_PADDING * 2);

  const [group, setGroup] = useState<MyGroupDetails | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!groupId) return;
    setIsLoading(true);
    setLoadError(null);

    const [groupsResult, memberList] = await Promise.all([fetchMyGroups(), fetchGroupMembers(groupId)]);

    // A fetch failure here must not read as "this booking doesn't exist" —
    // that's the same booking a paid, matched student just tapped in from
    // the Bookings tab.
    if (groupsResult.error) {
      setLoadError(groupsResult.error);
      setIsLoading(false);
      return;
    }

    setGroup(groupsResult.data.find((g) => g.group_id === groupId) ?? null);
    setMembers(memberList);
    setIsLoading(false);
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (isLoading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={LOADER} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.root, styles.centered, { paddingHorizontal: 24 }]}>
        <View style={{ width: contentWidth, gap: 16 }}>
          <Text style={[FlowText.titleCentred, { fontSize: 22 }]}>Couldn&apos;t load this.</Text>
          <Text style={styles.centredSubtitle}>{loadError}</Text>
          <FlowPillButton label="Retry" width={contentWidth} onPress={load} />
        </View>
      </View>
    );
  }

  if (!group) {
    return (
      <View style={[styles.root, styles.centered, { paddingHorizontal: 24 }]}>
        <View style={{ width: contentWidth, gap: 16 }}>
          <Text style={[FlowText.titleCentred, { fontSize: 22 }]}>Not found</Text>
          <Text style={styles.centredSubtitle}>This booking could not be found.</Text>
          <FlowBackButton onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={{ width: contentWidth }}>
          <Text style={styles.pageTitle}>Booking Details</Text>

          {!group.is_revealed ? (
            // Identical copy to the Chat section's lock state — same
            // reveal_venue_at gate, same wording, so Booking and Chat never
            // disagree about whether the venue is out yet. The 🔒 that led it
            // is gone: the redesign draws its marks and has no lock among
            // them, and the sentence carries the state on its own.
            <View style={styles.lockState}>
              <Text style={FlowText.titleCentred}>
                The venue and your group chat unlock 48 hours before the event.
              </Text>
              <Text style={styles.centredSubtitle}>
                Check back {formatSlotDateTime(group.reveal_venue_at)}.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 28 }}>
              <DetailRow
                label="Activity"
                value={group.activity_name}
                art={group.activity_name}
                width={contentWidth}
              />
              <DetailRow
                label="Venue"
                value={group.venue_name ?? ''}
                detail={group.venue_address}
                width={contentWidth}
                onPress={group.venue_maps_url ? () => Linking.openURL(group.venue_maps_url!) : undefined}
                actionLabel="Open in Google Maps →"
              />
              {/* Day plus formatEventTime, not formatSlotDateTime plus it:
                  that already carries the clock time for every activity but
                  Movies, so the two together printed it twice ("Sat, 5th ·
                  07:00 pm · 07:00 pm"). formatEventTime is the right half to
                  keep — once the venue is out, a matched student needs the
                  exact hour even for a Movie, whose slot time is otherwise
                  deliberately hidden. */}
              <DetailRow
                label="When"
                value={`${formatSlotDay(group.slot_datetime)} · ${formatEventTime(group.slot_datetime)}`}
                detail={
                  group.activity_name === 'Movies'
                    ? 'Movie tickets are shared one day before the event.'
                    : undefined
                }
                width={contentWidth}
              />

              <View style={{ gap: 14 }}>
                <Text style={FlowText.sectionLabel}>Your group</Text>
                {/* One row per member rather than one box holding them all:
                    the row art is a 902x154 box, and stretching it tall enough
                    for five lines pulls its corners out of shape. */}
                <View style={{ gap: 10 }}>
                  {members.map((member) => (
                    <FlowSurfaceBox key={member.id} width={contentWidth}>
                      <View style={styles.rowContent}>
                        <Text style={FlowText.panelLabel}>
                          {member.first_name} · {member.year_of_study}yr
                        </Text>
                      </View>
                    </FlowSurfaceBox>
                  ))}
                </View>
              </View>

              <FlowPillButton
                label="Open group chat  →"
                width={contentWidth}
                onPress={() =>
                  router.push({ pathname: '/(flow)/group/[groupId]', params: { groupId: group.group_id } })
                }
              />
            </View>
          )}

          <View style={{ marginTop: 34 }}>
            <FlowBackButton onPress={() => router.back()} />
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
    // The header drop the rest of this stack uses.
    paddingTop: 88,
    paddingHorizontal: 16,
    paddingBottom: 48,
  },
  pageTitle: {
    ...FlowText.title,
    marginBottom: 30,
  },
  lockState: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 24,
  },
  centredSubtitle: {
    ...FlowText.subtitle,
    textAlign: 'center',
  },
  // In flow rather than absolute, matching FlowActionRow, so a long address
  // wraps and takes the row with it instead of being clipped.
  rowContent: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 14,
    // Badge to label at roughly the gap the summary card sets between the two.
    gap: 13,
  },
  rowDetail: {
    ...FlowText.subtitle,
    fontSize: 13,
    marginTop: 3,
  },
  rowLink: {
    ...FlowText.subtitle,
    fontSize: 13,
    marginTop: 6,
    color: Palette.paper,
    textDecorationLine: 'underline',
  },
});
