import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
  Linking,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FontFamily } from '@/constants/fonts';
import { FlowSurface, FlowText } from '@/constants/flow-theme';
import { activityArt } from '@/constants/activity-art';
import { FlowPanel } from '@/components/flow-panel';
import { FlowPillButton } from '@/components/flow-pill-button';
import { FlowBackArrow } from '@/components/flow-back-button';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { useChatStore } from '@/store/chat';
import { fetchMyGroups, fetchGroupMembers, markGroupRead, MyGroupDetails, GroupMember } from '@/lib/groups';
import { formatSlotDateTime, formatEventTime } from '@/lib/format';
import { REPORT_REASONS, fetchMyReportedUserIds, submitReport } from '@/lib/reports';

// This screen previously ran on the app's original OS-color-scheme theme
// (ThemedView/ThemedText, via useColorScheme) instead of the fixed
// black/cream AuthPalette every other signed-in screen uses — the app has
// no real light mode, AuthPalette.canvas is a permanent black, so that old
// system could render this one screen light/white while everything else
// stayed black, depending on the device's OS theme. Converted to match.

interface ChatMessage {
  id: string;
  sender_id: string;
  content: string | null;
  is_system: boolean;
  created_at: string;
  deleted_at: string | null;
  data: { mapsUrl?: string } | null;
}

/** Matches the primary pill's near-white, as the other redesigned screens set it. */
const LOADER = '#FFFDF8';

// Caps the per-load message fetch so an old, long-running group doesn't
// slow re-opens down over time. No "load older messages" affordance yet —
// out of scope for now, this just stops unbounded growth from being a
// performance problem.
const MESSAGE_FETCH_LIMIT = 100;

export default function GroupScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const refreshUnreadCount = useChatStore((state) => state.refreshUnreadCount);

  // The report sheet's own column: it is inset 24dp from each edge, and both
  // the reason rows and its buttons are drawn art that has to be handed a
  // width rather than stretching.
  const sheetWidth = screenWidth - 48;

  const [group, setGroup] = useState<MyGroupDetails | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // Tracks whether this screen is the one actually on top right now (not
  // just mounted — Expo Router's native stack keeps screens pushed on top
  // of this one mounted underneath). A ref, not state: it's read from
  // inside the realtime callback below, never needs to trigger a render.
  const isFocusedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      return () => {
        isFocusedRef.current = false;
      };
    }, [])
  );

  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [realtimeRetryCount, setRealtimeRetryCount] = useState(0);

  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const [reportStep, setReportStep] = useState<'members' | 'reason' | 'done' | null>(null);
  const [reportTarget, setReportTarget] = useState<GroupMember | null>(null);
  const [reportMessage, setReportMessage] = useState<ChatMessage | null>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportError, setReportError] = useState('');
  const [leaving, setLeaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!groupId) return;
      let cancelled = false;

      const load = async () => {
        setIsLoading(true);
        setLoadError(null);

        const [groupsResult, memberList, reportedUserIds] = await Promise.all([
          fetchMyGroups(),
          fetchGroupMembers(groupId),
          fetchMyReportedUserIds(groupId),
        ]);
        if (cancelled) return;

        // A fetch failure must not render as "this group doesn't exist" —
        // it's the same group the student is already in and paid for.
        if (groupsResult.error) {
          setLoadError(groupsResult.error);
          setIsLoading(false);
          return;
        }

        const thisGroup = groupsResult.data.find((g) => g.group_id === groupId) ?? null;
        setGroup(thisGroup);
        setMembers(memberList);
        setReportedIds(new Set(reportedUserIds));

        if (thisGroup?.is_revealed) {
          // Most recent MESSAGE_FETCH_LIMIT, oldest-first for display —
          // fetched newest-first then reversed, rather than an offset from
          // the start, so a long-running group's older history doesn't
          // slow this query down as it grows.
          const { data } = await supabase
            .from('messages')
            .select('id, sender_id, content, is_system, created_at, deleted_at, data')
            .eq('group_id', groupId)
            .order('created_at', { ascending: false })
            .limit(MESSAGE_FETCH_LIMIT);
          if (!cancelled && data) setMessages([...data].reverse() as ChatMessage[]);

          // Opening the chat is what "reading" it means — bump the read
          // marker and refresh the shared badge count immediately rather
          // than waiting for the layout's next poll cycle.
          await markGroupRead(groupId);
          if (!cancelled) refreshUnreadCount();
        }

        if (!cancelled) setIsLoading(false);
      };

      load();

      return () => {
        cancelled = true;
      };
      // retryCount isn't read in the body above — it's a pure re-run
      // trigger for the Retry button on a load failure, the same "bump a
      // counter to force the effect to fire again" pattern useFocusEffect
      // itself doesn't otherwise expose a manual re-invoke for.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId, refreshUnreadCount, retryCount])
  );

  useEffect(() => {
    if (!groupId || !group?.is_revealed) return;

    const channel = supabase
      .channel(`messages-${groupId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` },
        (payload) => {
          const incoming = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));

          // This screen being open and receiving the message live IS the
          // user reading it — keep the read marker (and the shared badge)
          // current instead of only updating it on the next visit/poll.
          // Gated on isFocusedRef, not just "mounted": Expo Router's native
          // stack keeps this screen mounted underneath anything pushed on
          // top of it (e.g. Invite, Booking Details), so without this an
          // incoming message could get silently marked read while the user
          // is actually looking at a different screen.
          if (incoming.sender_id !== user?.id && groupId && isFocusedRef.current) {
            markGroupRead(groupId).then(refreshUnreadCount);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` },
        (payload) => {
          const updated = payload.new as ChatMessage;
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('connected');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setRealtimeStatus('error');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, group?.is_revealed, user?.id, refreshUnreadCount, realtimeRetryCount]);

  const memberName = (senderId: string) =>
    members.find((m) => m.id === senderId)?.first_name ?? 'Someone';

  const handleSend = async () => {
    const content = input.trim();
    if (!content || !user?.id || !groupId) return;

    setInput('');

    // Local echo: show the message immediately under a client-side temp
    // id, rather than waiting for it to round-trip through realtime. Without
    // this, a briefly disconnected/reconnecting socket at send time gave no
    // feedback at all — the message could genuinely be sending while
    // looking exactly like it wasn't, tempting a resend and a real
    // duplicate once the socket caught up.
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        sender_id: user.id,
        content,
        is_system: false,
        created_at: new Date().toISOString(),
        deleted_at: null,
        data: null,
      },
    ]);

    const { data, error } = await supabase
      .from('messages')
      .insert({ group_id: groupId, sender_id: user.id, content })
      .select('id, sender_id, content, is_system, created_at, deleted_at, data')
      .single();

    if (error || !data) {
      console.error('Failed to send message:', error);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(content);
      Alert.alert("Couldn't send", 'Your message wasn’t sent. Give it another try.');
      return;
    }

    // Swap the temp placeholder for the real row. The realtime INSERT
    // handler dedupes by id, so if it already delivered this same row
    // (race between the socket and this request's own response), drop the
    // placeholder without adding a second copy rather than blindly
    // appending.
    setMessages((prev) => {
      const withoutPlaceholder = prev.filter((m) => m.id !== tempId);
      if (withoutPlaceholder.some((m) => m.id === data.id)) return withoutPlaceholder;
      return [...withoutPlaceholder, data as ChatMessage];
    });
  };

  const handleDeleteMessage = (messageId: string) => {
    Alert.alert('Delete message?', 'This removes it for everyone in the group.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const deletedAt = new Date().toISOString();
          setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? { ...m, content: null, deleted_at: deletedAt } : m))
          );
          const { error } = await supabase
            .from('messages')
            .update({ deleted_at: deletedAt })
            .eq('id', messageId);
          if (error) console.error('Failed to delete message:', error);
        },
      },
    ]);
  };

  const handleLeaveGroup = () => {
    if (!group) return;
    Alert.alert(
      'Leave this group?',
      'You’ll lose access to the chat and this group will disappear from your list. Everyone else stays as they are.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setLeaving(true);
            const { error } = await supabase
              .from('group_members')
              .update({ left_at: new Date().toISOString() })
              .eq('booking_id', group.booking_id);
            setLeaving(false);
            if (error) {
              console.error('Failed to leave group:', error);
              Alert.alert('Could not leave the group', 'Please try again.');
              return;
            }
            closeReportSheet();
            router.back();
          },
        },
      ]
    );
  };

  // Doubles as the "Group Details" panel (tapped from the sticky header) —
  // the 'members' step already showed who's in the group, so it's the
  // natural home for member info generally, with reporting one of them as
  // an action available from there rather than a separate screen.
  const openGroupDetails = () => {
    setReportError('');
    setReportStep('members');
  };

  const closeReportSheet = () => {
    setReportStep(null);
    setReportTarget(null);
    setReportMessage(null);
    setSelectedReason(null);
    setReportError('');
  };

  const chooseReportTarget = (member: GroupMember) => {
    setReportTarget(member);
    setReportMessage(null);
    setSelectedReason(null);
    setReportError('');
    setReportStep('reason');
  };

  const openMessageReportSheet = (message: ChatMessage) => {
    const sender = members.find((m) => m.id === message.sender_id);
    if (!sender || reportedIds.has(sender.id)) return;

    setReportTarget(sender);
    setReportMessage(message);
    setSelectedReason(null);
    setReportError('');
    setReportStep('reason');
  };

  const handleSubmitReport = async () => {
    if (!reportTarget || !selectedReason || !groupId || !user?.id) return;

    setSubmittingReport(true);
    setReportError('');
    try {
      await submitReport({
        reporterId: user.id,
        reportedUserId: reportTarget.id,
        groupId,
        reason: selectedReason,
        messageId: reportMessage?.id,
      });
      setReportedIds((prev) => new Set(prev).add(reportTarget.id));
      setReportStep('done');
    } catch (error) {
      console.error('Failed to submit report:', error);
      setReportError('Could not send that report. Please try again.');
    } finally {
      setSubmittingReport(false);
    }
  };

  const hasMeetHappened = group != null && new Date(group.slot_datetime) < new Date();

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
        <View style={{ width: sheetWidth, gap: 16 }}>
          <Text style={[FlowText.titleCentred, { fontSize: 22 }]}>Couldn&apos;t load this.</Text>
          <Text style={styles.centredSubtitle}>{loadError}</Text>
          <FlowPillButton label="Retry" width={sheetWidth} onPress={() => setRetryCount((n) => n + 1)} />
        </View>
      </View>
    );
  }

  if (!group) {
    return (
      <View style={[styles.root, styles.centered, { paddingHorizontal: 24 }]}>
        <Text style={styles.centredSubtitle}>This group could not be found.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      // 'undefined' on Android meant the keyboard could cover the input
      // row entirely with nothing to push it back into view — 'height'
      // is the standard fix for a chat-style screen (resizes the
      // container instead of padding it, which is what 'padding' does
      // on iOS).
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.flex}>
        {/* Sticky group header — stays fixed above the message list (it
            lives outside the ScrollView below), unlike the venue/member
            info, which scrolls away with the conversation. Tapping it opens
            Group Details rather than jumping straight into report, since
            that's now the general "who's in this group" home. */}
        <View style={styles.header}>
          {/* A back control the screen never had: pushed on top of the tabs,
              iOS had only the swipe gesture to leave a chat with. */}
          <FlowBackArrow onPress={() => router.back()} />
          <Pressable onPress={openGroupDetails} style={styles.headerTap} hitSlop={6}>
            {/* Coded circle rather than the summary card's badge art: that
                badge sizes off a card width, and this header has no card —
                matched to the row art's fill and stroke by value, the way
                the profile tab's photo ring is. */}
            <View style={styles.headerMark}>
              <Image
                source={activityArt(group.activity_name)}
                style={styles.headerMarkArt}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
            </View>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {group.activity_name}
            </Text>
            {/* Replaces a typed ⓘ — the redesign draws its marks. Points at
                Group Details, which this row opens. */}
            <Image
              source={require('@/assets/images/icon-chevron-right.png')}
              style={styles.headerChevron}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </Pressable>
        </View>
        <View style={styles.divider} />

        {!group.is_revealed ? (
          <View style={[styles.flex, styles.centered, { paddingHorizontal: 24 }]}>
            {/* The 🔒 that led this is gone: the redesign draws its marks and
                has no lock among them, and the sentence carries the state. */}
            <Text style={FlowText.titleCentred}>
              The venue and your group chat unlock 48 hours before the event.
            </Text>
            <Text style={[styles.centredSubtitle, { marginTop: 10 }]}>
              Check back {formatSlotDateTime(group.reveal_venue_at)}.
            </Text>
          </View>
        ) : (
          <>
            <ScrollView
              ref={scrollRef}
              style={styles.flex}
              contentContainerStyle={styles.scrollContent}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
              {/* Member list, shown once at the start of the conversation
                  rather than pinned above it — this scrolls away with the
                  rest of the chat. Only the group name in the header above
                  stays permanently visible. Venue/time intentionally
                  dropped from here (founder request) — it's still shown in
                  the Group Details panel via the header. */}
              <View style={styles.introBanner}>
                <View style={styles.memberChipsRow}>
                  {members.map((member) => (
                    <View key={member.id} style={styles.memberChip}>
                      <Text style={styles.memberChipText}>
                        {member.first_name} · {member.year_of_study}yr
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {messages.length === 0 ? (
                <Text style={styles.centredSubtitle}>Say hello to your group.</Text>
              ) : (
                <View style={{ gap: 12 }}>
                  {messages.map((message) =>
                    message.is_system ? (
                      message.data?.mapsUrl ? (
                        <Pressable
                          key={message.id}
                          onPress={() => Linking.openURL(message.data!.mapsUrl!)}
                        >
                          <Text style={styles.systemMessage}>{message.content}</Text>
                          <Text style={styles.systemMessageLink}>Open in Google Maps →</Text>
                        </Pressable>
                      ) : (
                        <Text key={message.id} style={styles.systemMessage}>
                          {message.content}
                        </Text>
                      )
                    ) : (
                      <Pressable
                        key={message.id}
                        onLongPress={() => {
                          if (message.deleted_at) return;
                          if (message.sender_id === user?.id) {
                            handleDeleteMessage(message.id);
                          } else {
                            openMessageReportSheet(message);
                          }
                        }}
                        style={[
                          styles.bubble,
                          message.sender_id === user?.id ? styles.bubbleOwn : styles.bubbleOther,
                        ]}
                      >
                        {message.sender_id !== user?.id && (
                          <Text style={styles.bubbleSender}>{memberName(message.sender_id)}</Text>
                        )}
                        {message.deleted_at ? (
                          <Text
                            style={[
                              styles.bubbleDeleted,
                              message.sender_id === user?.id ? styles.bubbleTextOwn : styles.bubbleTextOther,
                            ]}
                          >
                            Message deleted
                          </Text>
                        ) : (
                          <Text style={message.sender_id === user?.id ? styles.bubbleTextOwn : styles.bubbleTextOther}>
                            {message.content}
                          </Text>
                        )}
                      </Pressable>
                    )
                  )}
                </View>
              )}
            </ScrollView>

            {realtimeStatus === 'error' && (
              <Pressable
                style={styles.reconnectBanner}
                onPress={() => {
                  setRealtimeStatus('connecting');
                  setRealtimeRetryCount((c) => c + 1);
                }}
              >
                <Text style={styles.reconnectBannerText}>Connection lost — tap to reconnect</Text>
              </Pressable>
            )}

            <View style={[styles.inputRow, { paddingBottom: 12 + insets.bottom }]}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Message your group…"
                placeholderTextColor={Palette.placeholder}
                style={styles.input}
                returnKeyType="send"
                blurOnSubmit={false}
                onSubmitEditing={handleSend}
              />
              <Pressable
                onPress={handleSend}
                disabled={!input.trim()}
                style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
              >
                <Text style={styles.sendButtonText}>Send</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>

      <Modal visible={reportStep !== null} animationType="slide" transparent onRequestClose={closeReportSheet}>
        <View style={styles.modalOverlay}>
          <View style={[styles.sheet, { paddingBottom: 40 + insets.bottom }]}>
            {reportStep === 'members' && (
              <>
                <Text style={styles.sheetTitle}>Group Details</Text>
                <Text style={styles.sheetSubtitle}>
                  {group.activity_name}
                  {group.venue_name
                    ? ` · ${group.venue_name}${group.venue_address ? ' · ' + group.venue_address : ''}`
                    : ''}{' '}
                  · {formatEventTime(group.slot_datetime)}
                </Text>
                <View style={{ gap: 8 }}>
                  {members.map((member) => {
                    const isSelf = member.id === user?.id;
                    const alreadyReported = reportedIds.has(member.id);
                    return (
                      <View key={member.id} style={styles.memberRow}>
                        <Text style={styles.memberRowText}>
                          {member.first_name} · {member.year_of_study}yr{isSelf ? ' (You)' : ''}
                        </Text>
                        {!isSelf && (
                          <Pressable
                            onPress={() => !alreadyReported && chooseReportTarget(member)}
                            disabled={alreadyReported}
                            hitSlop={8}
                          >
                            <Text style={[styles.reportLink, { color: alreadyReported ? Palette.muted : Palette.error }]}>
                              {alreadyReported ? 'Reported' : 'Report'}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </View>

                {hasMeetHappened && (
                  <Pressable onPress={handleLeaveGroup} disabled={leaving} style={styles.leaveButton}>
                    <Text style={styles.leaveButtonText}>{leaving ? 'Leaving…' : 'Leave this group'}</Text>
                  </Pressable>
                )}

                <Pressable onPress={closeReportSheet} style={styles.secondaryButton}>
                  <Text style={styles.secondaryLabel}>Close</Text>
                </Pressable>
              </>
            )}

            {reportStep === 'reason' && reportTarget && (
              <>
                <Text style={styles.sheetTitle}>Report {reportTarget.first_name}</Text>
                <Text style={styles.sheetSubtitle}>
                  {reportMessage ? 'This message is sent privately to the founder.' : 'What happened?'}
                </Text>
                {reportMessage && (
                  <View style={[styles.memberRow, { marginBottom: 16 }]}>
                    <Text style={styles.memberRowText}>{reportMessage.content}</Text>
                  </View>
                )}
                {/* The flow's own single-select row, the same one the booking
                    steps and the quiz pick from, rather than a second
                    selection language invented for this sheet. Left-ranged:
                    these read as sentences, not as "Under ₹200". */}
                <View style={{ gap: 12 }}>
                  {REPORT_REASONS.map((reason) => (
                    <FlowPanel
                      key={reason}
                      label={reason}
                      align="left"
                      selected={selectedReason === reason}
                      dimmed={selectedReason !== null && selectedReason !== reason}
                      width={sheetWidth}
                      onPress={() => setSelectedReason(reason)}
                    />
                  ))}
                </View>
                {reportError ? <Text style={styles.errorText}>{reportError}</Text> : null}
                <View style={{ marginTop: 24, gap: 12 }}>
                  <FlowPillButton
                    label={submittingReport ? 'Sending…' : 'Send report'}
                    width={sheetWidth}
                    onPress={handleSubmitReport}
                    loading={submittingReport}
                    disabled={!selectedReason}
                  />
                  <Pressable
                    onPress={() => (reportMessage ? closeReportSheet() : setReportStep('members'))}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryLabel}>{reportMessage ? 'Cancel' : 'Back'}</Text>
                  </Pressable>
                </View>
              </>
            )}

            {reportStep === 'done' && (
              <>
                <Text style={styles.sheetTitle}>Report sent</Text>
                <Text style={[styles.sheetSubtitle, { marginBottom: 24 }]}>
                  The founder will look into this. Thanks for telling us.
                </Text>
                <FlowPillButton label="Done" width={sheetWidth} onPress={closeReportSheet} />
              </>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

/**
 * This screen is now on the redesign like the rest of the signed-in app: black
 * canvas, the flow's type (Inter/SF Pro via FlowText) and its row surface.
 *
 * The chat's own furniture — bubbles, chips, the input, the report sheet — has
 * no comp and can't use the drawn row art either: that art is a 902x154 box,
 * and squeezing it into a chip or a bubble turns its rounded corners
 * elliptical. So those are coded against FlowSurface's documented values,
 * which is what that export exists for.
 */
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  flex: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centredSubtitle: {
    ...FlowText.subtitle,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 22,
    paddingTop: 54,
    paddingBottom: 16,
  },
  /** The tappable group row: everything but the back arrow opens Group Details. */
  headerTap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerMark: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: FlowSurface.stroke,
    backgroundColor: FlowSurface.fill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerMarkArt: {
    width: 34 * 0.66,
    height: 34 * 0.66,
  },
  headerTitle: {
    ...FlowText.rowLabel,
    flex: 1,
  },
  headerChevron: {
    width: 8,
    // icon-chevron-right.png is 27x47.
    height: 8 * (47 / 27),
  },
  divider: {
    height: 1,
    backgroundColor: FlowSurface.stroke,
    opacity: 0.5,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingVertical: 16,
  },
  introBanner: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: FlowSurface.stroke,
  },
  memberChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  // Dark chips with a hairline, not the cream pills these were: a cream pill
  // is this design's primary action, and a row of them read as a row of
  // buttons rather than as who is in the room.
  memberChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FlowSurface.stroke,
    backgroundColor: FlowSurface.fill,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  memberChipText: {
    ...FlowText.fine,
    color: '#FFFFFF',
  },
  systemMessage: {
    ...FlowText.fine,
    textAlign: 'center',
  },
  systemMessageLink: {
    ...FlowText.fine,
    textAlign: 'center',
    color: Palette.paper,
    textDecorationLine: 'underline',
    marginTop: 4,
  },
  reconnectBanner: {
    backgroundColor: Palette.error,
    paddingVertical: 8,
    alignItems: 'center',
  },
  reconnectBannerText: {
    ...FlowText.fine,
    color: Palette.line,
    fontWeight: '600',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  // Own messages carry the primary action's near-white; everyone else's sit on
  // the row surface, so the two stay legible against each other and the canvas.
  bubbleOwn: {
    alignSelf: 'flex-end',
    backgroundColor: '#FFFDF8',
  },
  bubbleOther: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: FlowSurface.stroke,
    backgroundColor: FlowSurface.fill,
  },
  bubbleSender: {
    ...FlowText.fine,
    fontSize: 11,
    marginBottom: 2,
  },
  bubbleTextOwn: {
    ...FlowText.rowLabel,
    color: FlowSurface.ink,
  },
  bubbleTextOther: {
    ...FlowText.rowLabel,
  },
  bubbleDeleted: {
    fontStyle: 'italic',
    opacity: 0.7,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 22,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: FlowSurface.stroke,
  },
  input: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FlowSurface.stroke,
    backgroundColor: FlowSurface.fill,
    paddingHorizontal: 16,
    paddingVertical: 11,
    ...FlowText.fieldText,
    fontSize: 15,
  },
  sendButton: {
    borderRadius: 999,
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    ...FlowText.pillLabel,
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  sheet: {
    backgroundColor: '#000000',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: FlowSurface.stroke,
    paddingHorizontal: 24,
    paddingTop: 26,
  },
  sheetTitle: {
    ...FlowText.titleCompact,
    marginBottom: 6,
  },
  sheetSubtitle: {
    ...FlowText.subtitle,
    fontSize: 13,
    marginBottom: 18,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FlowSurface.stroke,
    backgroundColor: FlowSurface.fill,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  memberRowText: {
    ...FlowText.rowLabel,
    flexShrink: 1,
  },
  reportLink: {
    fontSize: 12,
    fontFamily: FontFamily.accent.sfProDisplayMedium,
  },
  errorText: {
    ...FlowText.error,
    textAlign: 'left',
    fontSize: 13,
    marginTop: 10,
  },
  leaveButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  leaveButtonText: {
    color: Palette.error,
    fontSize: 14,
    fontFamily: FontFamily.accent.sfProDisplayMedium,
  },
  secondaryButton: {
    marginTop: 18,
    alignItems: 'center',
  },
  secondaryLabel: {
    ...FlowText.link,
  },
});
