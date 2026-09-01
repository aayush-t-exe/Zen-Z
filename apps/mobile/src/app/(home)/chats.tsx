import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FontFamily } from '@/constants/fonts';
import { AuthButton } from '@/components/auth-button';
import { fetchMyGroups, MyGroupDetails } from '@/lib/groups';
import { formatSlotDateTime } from '@/lib/format';

export default function ChatsScreen() {
  const router = useRouter();
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
        <ActivityIndicator size="large" color={Palette.text} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }]}>
        <Text style={[styles.pageTitle, { textAlign: 'center' }]}>Couldn&apos;t load this.</Text>
        <Text style={[styles.emptyText, styles.emptyTextCentered, { marginTop: 8, marginBottom: 24 }]}>
          {loadError}
        </Text>
        <AuthButton label="Retry" onPress={load} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scroll, groups.length === 0 && styles.scrollEmpty]}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Group Chats</Text>

        {groups.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, styles.emptyTextCentered]}>
              Once your group is matched, you&apos;ll chat here.
            </Text>
            <AuthButton label="Back to home  →" onPress={() => router.push('/(home)')} />
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
                style={styles.card}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
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
              </Pressable>
            ))}
          </View>
        )}
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
    color: Palette.text,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: FontFamily.display.bold,
    marginBottom: 20,
  },
  emptyText: {
    color: Palette.muted,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: FontFamily.body.regular,
  },
  card: {
    borderWidth: 2.5,
    borderColor: Palette.ring,
    borderRadius: 20,
    padding: 18,
  },
  cardTitle: {
    color: Palette.text,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FontFamily.body.bold,
  },
  cardSubtitle: {
    color: Palette.muted,
    fontSize: 14,
    fontFamily: FontFamily.body.regular,
    marginTop: 4,
  },
});
