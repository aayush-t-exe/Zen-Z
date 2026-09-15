import { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  FLOW_CONTENT_MAX,
  FLOW_SIDE_PADDING,
  FlowText,
} from '@/constants/flow-theme';
import { ACTIVITY_ART_BADGE_SCALE, activityArt } from '@/constants/activity-art';
import { FlowSurfaceBox } from '@/components/flow-panel';
import { FlowPillButton } from '@/components/flow-pill-button';
import { SummaryBadge } from '@/components/summary-card';
import { fetchMyGroups } from '@/lib/groups';
import { formatSlotDateTime } from '@/lib/format';
import { useAuthStore } from '@/store/auth';
import { myGroupsKey } from '@/lib/queryKeys';

/** icon-chevron-right.png is 27x47. */
const CHEVRON_ASPECT = 47 / 27;

export default function ChatsScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const userId = useAuthStore((state) => state.user?.id);
  // Same content column the rest of the redesign runs.
  const contentWidth = Math.min(FLOW_CONTENT_MAX, screenWidth - FLOW_SIDE_PADDING * 2);

  // Cached rather than local useState + a fetch-on-focus effect — this tab
  // stays mounted between visits, so switching back to it used to always
  // show a blank/spinner reset while it refetched from scratch. Kept on
  // the same query key bookings.tsx uses for groups, so whichever screen
  // fetched most recently warms the other's cache too.
  const {
    data: groups = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: myGroupsKey(userId ?? ''),
    queryFn: async () => {
      const result = await fetchMyGroups();
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    enabled: !!userId,
  });
  const loadError = error instanceof Error ? error.message : null;

  // Still refetches every focus — a group can get matched, revealed or
  // paid for from another screen — but now it's a background refresh
  // behind the cached list rather than a full loading-state reset each
  // time, since `data` holds the previous result until the new one lands.
  useFocusEffect(
    useCallback(() => {
      if (userId) refetch();
    }, [userId, refetch])
  );

  if (isLoading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={LOADER} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }]}>
        <Text style={[FlowText.titleCentred, { fontSize: 22 }]}>Couldn&apos;t load this.</Text>
        <Text style={[styles.emptyText, styles.emptyTextCentered, { marginTop: 8, marginBottom: 24 }]}>
          {loadError}
        </Text>
        <FlowPillButton label="Retry" width={contentWidth} onPress={() => refetch()} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scroll, groups.length === 0 && styles.scrollEmpty]}
        showsVerticalScrollIndicator={false}>
        {/* The scroll centres this column, so the heading and cards range
            left against the same margin the rest of the redesign uses
            instead of each centring on its own width. */}
        <View style={[{ width: contentWidth }, groups.length === 0 && { flex: 1 }]}>
        {/* "Messages", not "Group Chats": that is the label on the tab that
            got you here (see (home)/_layout.tsx and the 2026-09-02 copy change
            in docs/PRODUCT_SPEC.md §1.5), and the heading was still the old
            wording. The route, store and notification routing all still key
            off `chats`. */}
        <Text style={styles.pageTitle}>Messages</Text>

        {groups.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, styles.emptyTextCentered]}>
              Once your group is matched, you&apos;ll chat here.
            </Text>
            <FlowPillButton
              label="Back to home  →"
              width={contentWidth}
              onPress={() => router.push('/(home)')}
            />
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            {groups.map((group) => (
              <Pressable
                key={group.group_id}
                onPress={() =>
                  router.push({
                    pathname: '/(flow)/group/[groupId]',
                    params: { groupId: group.group_id },
                  })
                }
              >
                <FlowSurfaceBox width={contentWidth}>
                  <View style={styles.cardBody}>
                    {/* The activity's own render on the summary card's badge,
                        where the row used to prefix its title with
                        activity_emoji and close with a 💬/🔒 pair — the
                        redesign draws its marks rather than setting emoji. The
                        locked state stays in the subtitle, which says outright
                        when the chat unlocks; the row opens either way, so the
                        chevron does not promise something the lock denied. */}
                    <SummaryBadge
                      cardWidth={contentWidth}
                      icon={{ source: activityArt(group.activity_name), scale: ACTIVITY_ART_BADGE_SCALE }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {group.activity_name}
                      </Text>
                      <Text style={styles.cardSubtitle} numberOfLines={1}>
                        {group.is_revealed
                          ? group.venue_name ?? formatSlotDateTime(group.slot_datetime, group.activity_name)
                          : `Unlocks ${formatSlotDateTime(group.reveal_venue_at)}`}
                      </Text>
                    </View>
                    <Image
                      source={require('@/assets/images/icon-chevron-right.png')}
                      style={styles.chevron}
                      resizeMode="contain"
                      accessibilityIgnoresInvertColors
                    />
                  </View>
                </FlowSurfaceBox>
              </Pressable>
            ))}
          </View>
        )}
        </View>
      </ScrollView>
    </View>
  );
}

/** Matches the primary pill's near-white, same as the progress bar's fill. */
const LOADER = '#FFFDF8';

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
    // 33 bottom offset, plus breathing room) or the last card sits under it.
    // Same allowance the Home screen makes.
    paddingBottom: 116,
  },
  scrollEmpty: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  emptyTextCentered: {
    textAlign: 'center',
  },
  pageTitle: {
    ...FlowText.title,
    marginBottom: 24,
  },
  emptyText: {
    ...FlowText.subtitle,
    fontSize: 15,
    lineHeight: 21,
  },
  cardBody: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 18,
    // Badge to label at roughly the gap the summary card sets between the two.
    gap: 13,
  },
  chevron: {
    width: 9,
    height: 9 * CHEVRON_ASPECT,
  },
  cardTitle: {
    ...FlowText.panelLabel,
    fontSize: 16,
  },
  cardSubtitle: {
    ...FlowText.subtitle,
    fontSize: 13,
    marginTop: 4,
  },
});
