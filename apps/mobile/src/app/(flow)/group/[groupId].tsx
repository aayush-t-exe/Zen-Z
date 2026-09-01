import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FontFamily } from '@/constants/fonts';
import { AuthButton } from '@/components/auth-button';
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
}

export default function GroupScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const refreshUnreadCount = useChatStore((state) => state.refreshUnreadCount);

  const [group, setGroup] = useState<MyGroupDetails | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

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
          const { data } = await supabase
            .from('messages')
            .select('id, sender_id, content, is_system, created_at, deleted_at')
            .eq('group_id', groupId)
            .order('created_at', { ascending: true });
          if (!cancelled && data) setMessages(data as ChatMessage[]);

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
          if (incoming.sender_id !== user?.id && groupId) {
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, group?.is_revealed, user?.id, refreshUnreadCount]);

  const memberName = (senderId: string) =>
    members.find((m) => m.id === senderId)?.first_name ?? 'Someone';

  const handleSend = async () => {
    const content = input.trim();
    if (!content || !user?.id || !groupId) return;

    setInput('');
    const { error } = await supabase
      .from('messages')
      .insert({ group_id: groupId, sender_id: user.id, content });

    if (error) {
      console.error('Failed to send message:', error);
      // No optimistic insert happens above, so a failure here means the
      // message never appeared anywhere — restore it to the input instead
      // of letting it vanish silently (the old, since-fixed behavior).
      setInput(content);
      Alert.alert("Couldn't send", 'Your message wasn’t sent. Give it another try.');
    }
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
        <ActivityIndicator size="large" color={Palette.text} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.root, styles.centered, { paddingHorizontal: 24, gap: 16 }]}>
        <Text style={styles.subtitle}>Couldn&apos;t load this. {loadError}</Text>
        <AuthButton label="Retry" onPress={() => setRetryCount((n) => n + 1)} />
      </View>
    );
  }

  if (!group) {
    return (
      <View style={[styles.root, styles.centered, { paddingHorizontal: 24 }]}>
        <Text style={styles.subtitle}>This group could not be found.</Text>
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
        <Pressable onPress={openGroupDetails} style={styles.header}>
          <Text style={styles.headerTitle}>{group.activity_name}</Text>
          <Text style={styles.headerInfo}>ⓘ</Text>
        </Pressable>
        <View style={styles.divider} />

        {!group.is_revealed ? (
          <View style={[styles.flex, styles.centered, { paddingHorizontal: 24 }]}>
            <Text style={styles.lockEmoji}>🔒</Text>
            <Text style={[styles.title, { textAlign: 'center' }]}>
              The venue and your group chat unlock 48 hours before the event.
            </Text>
            <Text style={[styles.subtitle, { textAlign: 'center', marginTop: 8 }]}>
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
                <Text style={[styles.subtitle, { textAlign: 'center' }]}>Say hello to your group.</Text>
              ) : (
                <View style={{ gap: 12 }}>
                  {messages.map((message) =>
                    message.is_system ? (
                      <Text key={message.id} style={styles.systemMessage}>
                        {message.content}
                      </Text>
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

            <View style={styles.inputRow}>
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
          <View style={styles.sheet}>
            {reportStep === 'members' && (
              <>
                <Text style={styles.sheetTitle}>Group Details</Text>
                <Text style={styles.sheetSubtitle}>
                  {group.activity_emoji} {group.activity_name}
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
                <View style={{ gap: 8 }}>
                  {REPORT_REASONS.map((reason) => (
                    <Pressable
                      key={reason}
                      onPress={() => setSelectedReason(reason)}
                      style={[styles.reasonOption, selectedReason === reason && styles.reasonOptionSelected]}
                    >
                      <Text style={styles.reasonText}>{reason}</Text>
                    </Pressable>
                  ))}
                </View>
                {reportError ? <Text style={styles.errorText}>{reportError}</Text> : null}
                <View style={{ marginTop: 24, gap: 12 }}>
                  <AuthButton
                    label={submittingReport ? 'Sending…' : 'Send report'}
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
                <AuthButton label="Done" onPress={closeReportSheet} />
              </>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Palette.canvas,
  },
  flex: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 16,
  },
  headerTitle: {
    color: Palette.text,
    fontSize: 17,
    fontWeight: '700',
    fontFamily: FontFamily.body.bold,
  },
  headerInfo: {
    color: Palette.muted,
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: Palette.ring,
    opacity: 0.4,
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
  lockEmoji: {
    fontSize: 44,
    marginBottom: 8,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  introBanner: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Palette.ring,
  },
  memberChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  memberChip: {
    borderRadius: 999,
    backgroundColor: Palette.paper,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  memberChipText: {
    color: Palette.line,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FontFamily.body.semiBold,
  },
  systemMessage: {
    color: Palette.muted,
    fontSize: 12,
    textAlign: 'center',
    fontFamily: FontFamily.body.regular,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bubbleOwn: {
    alignSelf: 'flex-end',
    backgroundColor: Palette.paper,
  },
  bubbleOther: {
    alignSelf: 'flex-start',
    backgroundColor: '#1E2128',
  },
  bubbleSender: {
    color: Palette.muted,
    fontSize: 11,
    marginBottom: 2,
    fontFamily: FontFamily.body.medium,
  },
  bubbleTextOwn: {
    color: Palette.line,
    fontSize: 15,
    fontFamily: FontFamily.body.regular,
  },
  bubbleTextOther: {
    color: Palette.text,
    fontSize: 15,
    fontFamily: FontFamily.body.regular,
  },
  bubbleDeleted: {
    fontStyle: 'italic',
    opacity: 0.7,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Palette.ring,
  },
  input: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Palette.ring,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: Palette.text,
    fontFamily: FontFamily.body.regular,
    fontSize: 15,
  },
  sendButton: {
    borderRadius: 999,
    backgroundColor: Palette.paper,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    color: Palette.line,
    fontWeight: '700',
    fontFamily: FontFamily.body.bold,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: Palette.canvas,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: Palette.ring,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  sheetTitle: {
    color: Palette.text,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: FontFamily.display.bold,
    marginBottom: 4,
  },
  sheetSubtitle: {
    color: Palette.muted,
    fontSize: 13,
    fontFamily: FontFamily.body.regular,
    marginBottom: 16,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    backgroundColor: '#1E2128',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  memberRowText: {
    color: Palette.text,
    fontSize: 15,
    fontFamily: FontFamily.body.medium,
    flexShrink: 1,
  },
  reportLink: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FontFamily.body.semiBold,
  },
  reasonOption: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Palette.ring,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  reasonOptionSelected: {
    borderColor: Palette.text,
    backgroundColor: '#1E2128',
  },
  reasonText: {
    color: Palette.text,
    fontFamily: FontFamily.body.regular,
    fontSize: 15,
  },
  errorText: {
    color: Palette.error,
    fontSize: 13,
    fontFamily: FontFamily.body.semiBold,
    marginTop: 8,
  },
  leaveButton: {
    borderWidth: 2,
    borderColor: Palette.error,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  leaveButtonText: {
    color: Palette.error,
    fontFamily: FontFamily.body.semiBold,
    fontSize: 14,
  },
  secondaryButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  secondaryLabel: {
    color: Palette.muted,
    fontSize: 14,
    fontFamily: FontFamily.body.semiBold,
  },
});
