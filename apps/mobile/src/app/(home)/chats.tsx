import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  FLOW_CONTENT_MAX,
  FLOW_SIDE_PADDING,
  FlowText,
} from '@/constants/flow-theme';
import { FlowSurfaceBox } from '@/components/flow-panel';
import { FlowPillButton } from '@/components/flow-pill-button';
import { fetchMyGroups, MyGroupDetails } from '@/lib/groups';
import { formatSlotDateTime } from '@/lib/format';

export default function ChatsScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  // Same content column the rest of the redesign runs.
  const contentWidth = Math.min(FLOW_CONTENT_MAX, screenWidth - FLOW_SIDE_PADDING * 2);
  const [groups, setGroups] = useState<MyGroupDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const result = await fetchMyGroups();

    if (result.error) {
      setLoadError(result.error);
      setIsLoading(false);
      return;
    }

    setGroups(result.data);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
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
        <FlowPillButton label="Retry" width={contentWidth} onPress={load} />
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
        <Text style={styles.pageTitle}>Group Chats</Text>

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
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>
                        {group.activity_emoji} {group.activity_name}
                      </Text>
                      <Text style={styles.cardSubtitle}>
                        {group.is_revealed
                          ? group.venue_name ?? formatSlotDateTime(group.slot_datetime, group.activity_name)
                          : `Unlocks ${formatSlotDateTime(group.reveal_venue_at)}`}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 18 }}>{group.is_revealed ? '💬' : '🔒'}</Text>
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
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 18,
    gap: 12,
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
