import { useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FontFamily } from '@/constants/fonts';
import { AuthButton } from '@/components/auth-button';
import { fetchMyGroups, fetchGroupMembers, MyGroupDetails, GroupMember } from '@/lib/groups';
import { formatSlotDateTime, formatEventTime } from '@/lib/format';

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
        <ActivityIndicator size="large" color={Palette.text} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.root, styles.centered, { paddingHorizontal: 24, gap: 16 }]}>
        <Text style={styles.subtitle}>Couldn&apos;t load this. {loadError}</Text>
        <AuthButton label="Retry" onPress={load} />
      </View>
    );
  }

  if (!group) {
    return (
      <View style={[styles.root, styles.centered, { paddingHorizontal: 24 }]}>
        <Text style={styles.subtitle}>This booking could not be found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Booking Details</Text>

        {!group.is_revealed ? (
          // Identical copy to the Chat section's lock state — same
          // reveal_venue_at gate, same wording, so Booking and Chat never
          // disagree about whether the venue is out yet.
          <View style={styles.lockCard}>
            <Text style={styles.lockEmoji}>🔒</Text>
            <Text style={[styles.title, { textAlign: 'center' }]}>
              The venue and your group chat unlock 48 hours before the event.
            </Text>
            <Text style={[styles.subtitle, { textAlign: 'center', marginTop: 8 }]}>
              Check back {formatSlotDateTime(group.reveal_venue_at)}.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 18 }}>
            <View style={styles.card}>
              <View style={[styles.cardSection, { borderTopWidth: 0, paddingTop: 0 }]}>
                <Text style={styles.cardLabel}>Activity</Text>
                <Text style={styles.cardValue}>
                  {group.activity_emoji} {group.activity_name}
                </Text>
              </View>

              <View style={styles.cardSection}>
                <Text style={styles.cardLabel}>Venue</Text>
                <Text style={styles.cardValue}>{group.venue_name}</Text>
                {group.venue_address && <Text style={styles.cardSubvalue}>{group.venue_address}</Text>}
              </View>

              <View style={styles.cardSection}>
                <Text style={styles.cardLabel}>When</Text>
                <Text style={styles.cardValue}>
                  {formatSlotDateTime(group.slot_datetime, group.activity_name)} · {formatEventTime(group.slot_datetime)}
                </Text>
              </View>

              <View style={styles.cardSection}>
                <Text style={styles.cardLabel}>Your group</Text>
                <View style={{ gap: 8, marginTop: 8 }}>
                  {members.map((member) => (
                    <View key={member.id} style={styles.memberRow}>
                      <Text style={styles.memberRowText}>
                        {member.first_name} · {member.year_of_study}yr
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <AuthButton
              label="Open group chat →"
              onPress={() => router.push({ pathname: '/(flow)/group/[groupId]', params: { groupId: group.group_id } })}
            />
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
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: 20,
  },
  lockCard: {
    alignItems: 'center',
    paddingTop: 40,
  },
  lockEmoji: {
    fontSize: 44,
    marginBottom: 8,
  },
  title: {
    color: Palette.text,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: FontFamily.display.bold,
  },
  subtitle: {
    color: Palette.muted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FontFamily.body.regular,
  },
  card: {
    borderWidth: 2.5,
    borderColor: Palette.ring,
    borderRadius: 20,
    padding: 20,
    gap: 18,
  },
  cardSection: {
    borderTopWidth: 1,
    borderTopColor: Palette.ring,
    paddingTop: 16,
    gap: 4,
  },
  cardLabel: {
    color: Palette.muted,
    fontSize: 12,
    fontFamily: FontFamily.body.regular,
  },
  cardValue: {
    color: Palette.text,
    fontSize: 17,
    fontWeight: '700',
    fontFamily: FontFamily.body.bold,
  },
  cardSubvalue: {
    color: Palette.muted,
    fontSize: 14,
    fontFamily: FontFamily.body.regular,
  },
  memberRow: {
    borderRadius: 12,
    backgroundColor: '#1E2128',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  memberRowText: {
    color: Palette.text,
    fontSize: 14,
    fontFamily: FontFamily.body.medium,
  },
});
