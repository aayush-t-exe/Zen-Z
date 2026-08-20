import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { fetchMyGroups, MyGroupDetails } from '@/lib/groups';
import { formatSlotDateTime } from '@/lib/format';

export default function ChatsScreen() {
  const router = useRouter();
  const [groups, setGroups] = useState<MyGroupDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const load = async () => {
        const data = await fetchMyGroups();
        if (!cancelled) {
          setGroups(data);
          setIsLoading(false);
        }
      };

      load();

      return () => {
        cancelled = true;
      };
    }, [])
  );

  if (isLoading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={Palette.text} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Group Chats</Text>

        {groups.length === 0 ? (
          <Text style={styles.emptyText}>Once your group is matched, you&apos;ll chat here.</Text>
        ) : (
          <View style={{ gap: 14 }}>
            {groups.map((group) => (
              <Pressable
                key={group.group_id}
                onPress={() =>
                  router.push({
                    pathname: '/(home)/group/[groupId]',
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
                        ? group.venue_name ?? formatSlotDateTime(group.slot_datetime)
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
  pageTitle: {
    color: Palette.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
  },
  emptyText: {
    color: Palette.muted,
    fontSize: 15,
    lineHeight: 21,
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
  },
  cardSubtitle: {
    color: Palette.muted,
    fontSize: 14,
    marginTop: 4,
  },
});
