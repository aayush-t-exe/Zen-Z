import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { fetchMyGroups, fetchGroupMembers, MyGroupDetails, GroupMember } from '@/lib/groups';
import { formatSlotDateTime } from '@/lib/format';
import { REPORT_REASONS, fetchMyReportedUserIds, submitReport } from '@/lib/reports';

interface ChatMessage {
  id: string;
  sender_id: string;
  content: string;
  is_system: boolean;
  created_at: string;
}

export default function GroupScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const user = useAuthStore((state) => state.user);

  const [group, setGroup] = useState<MyGroupDetails | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const [reportStep, setReportStep] = useState<'members' | 'reason' | 'done' | null>(null);
  const [reportTarget, setReportTarget] = useState<GroupMember | null>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportError, setReportError] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!groupId) return;
      let cancelled = false;

      const load = async () => {
        const [groups, memberList, reportedUserIds] = await Promise.all([
          fetchMyGroups(),
          fetchGroupMembers(groupId),
          fetchMyReportedUserIds(groupId),
        ]);
        if (cancelled) return;

        const thisGroup = groups.find((g) => g.group_id === groupId) ?? null;
        setGroup(thisGroup);
        setMembers(memberList);
        setReportedIds(new Set(reportedUserIds));

        if (thisGroup?.is_revealed) {
          const { data } = await supabase
            .from('messages')
            .select('id, sender_id, content, is_system, created_at')
            .eq('group_id', groupId)
            .order('created_at', { ascending: true });
          if (!cancelled && data) setMessages(data as ChatMessage[]);
        }

        if (!cancelled) setIsLoading(false);
      };

      load();

      return () => {
        cancelled = true;
      };
    }, [groupId])
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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, group?.is_revealed]);

  const memberName = (senderId: string) =>
    members.find((m) => m.id === senderId)?.full_name ?? 'Someone';

  const handleSend = async () => {
    const content = input.trim();
    if (!content || !user?.id || !groupId) return;

    setInput('');
    const { error } = await supabase
      .from('messages')
      .insert({ group_id: groupId, sender_id: user.id, content });

    if (error) {
      console.error('Failed to send message:', error);
    }
  };

  const openReportSheet = () => {
    setReportError('');
    setReportStep('members');
  };

  const closeReportSheet = () => {
    setReportStep(null);
    setReportTarget(null);
    setSelectedReason(null);
    setReportError('');
  };

  const chooseReportTarget = (member: GroupMember) => {
    setReportTarget(member);
    setSelectedReason(null);
    setReportError('');
    setReportStep('reason');
  };

  const handleSubmitReport = async () => {
    if (!reportTarget || !selectedReason || !groupId) return;

    setSubmittingReport(true);
    setReportError('');
    try {
      await submitReport({ reportedUserId: reportTarget.id, groupId, reason: selectedReason });
      setReportedIds((prev) => new Set(prev).add(reportTarget.id));
      setReportStep('done');
    } catch (error) {
      console.error('Failed to submit report:', error);
      setReportError('Could not send that report. Please try again.');
    } finally {
      setSubmittingReport(false);
    }
  };

  if (isLoading) {
    return (
      <ThemedView className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  if (!group) {
    return (
      <ThemedView className="flex-1 items-center justify-center px-6">
        <ThemedText type="default" themeColor="textSecondary">
          This group could not be found.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ThemedView className="flex-1">
        <View className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <View className="flex-row items-center justify-between">
            <ThemedText className="font-semibold">
              {group.activity_emoji} {group.activity_name}
            </ThemedText>
            <Pressable onPress={openReportSheet} hitSlop={8}>
              <ThemedText type="default" themeColor="textSecondary">
                ⓘ
              </ThemedText>
            </Pressable>
          </View>
          <ThemedText type="default" themeColor="textSecondary" className="mt-1 text-sm">
            {group.is_revealed && group.venue_name
              ? `${group.venue_name}${group.venue_address ? ' · ' + group.venue_address : ''}`
              : formatSlotDateTime(group.slot_datetime)}
          </ThemedText>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {members.map((member) => (
              <View
                key={member.id}
                className="rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-800"
              >
                <ThemedText type="default" className="text-xs">
                  {member.full_name} · {member.year_of_study}yr
                </ThemedText>
              </View>
            ))}
          </View>
        </View>

        {!group.is_revealed ? (
          <View className="flex-1 items-center justify-center px-6">
            <ThemedText className="mb-2 text-3xl">🔒</ThemedText>
            <ThemedText type="title" className="text-center text-lg">
              The venue and your group chat unlock 48 hours before the event.
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" className="mt-2 text-center text-sm">
              Check back {formatSlotDateTime(group.reveal_venue_at)}.
            </ThemedText>
          </View>
        ) : (
          <>
            <ScrollView
              ref={scrollRef}
              className="flex-1 px-6 py-4"
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
              {messages.length === 0 ? (
                <ThemedText type="default" themeColor="textSecondary" className="text-center text-sm">
                  Say hello to your group.
                </ThemedText>
              ) : (
                <View className="gap-3">
                  {messages.map((message) =>
                    message.is_system ? (
                      <ThemedText
                        key={message.id}
                        type="default"
                        themeColor="textSecondary"
                        className="text-center text-xs"
                      >
                        {message.content}
                      </ThemedText>
                    ) : (
                      <View
                        key={message.id}
                        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                          message.sender_id === user?.id
                            ? 'self-end bg-black dark:bg-white'
                            : 'self-start bg-gray-100 dark:bg-gray-800'
                        }`}
                      >
                        {message.sender_id !== user?.id && (
                          <ThemedText type="default" themeColor="textSecondary" className="text-xs">
                            {memberName(message.sender_id)}
                          </ThemedText>
                        )}
                        <ThemedText
                          themeColor={message.sender_id === user?.id ? 'invertedText' : undefined}
                        >
                          {message.content}
                        </ThemedText>
                      </View>
                    )
                  )}
                </View>
              )}
            </ScrollView>

            <View className="flex-row items-center gap-2 border-t border-gray-200 px-6 py-3 dark:border-gray-700">
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Message your group…"
                placeholderTextColor="#999"
                className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-black dark:border-gray-600 dark:text-white"
                onSubmitEditing={handleSend}
              />
              <Pressable
                onPress={handleSend}
                disabled={!input.trim()}
                className="rounded-full bg-black px-4 py-2 disabled:opacity-40 dark:bg-white"
              >
                <ThemedText themeColor="invertedText" className="font-semibold">
                  Send
                </ThemedText>
              </Pressable>
            </View>
          </>
        )}
      </ThemedView>

      <Modal
        visible={reportStep !== null}
        animationType="slide"
        transparent
        onRequestClose={closeReportSheet}
      >
        <View className="flex-1 justify-end bg-black/40">
          <ThemedView className="rounded-t-3xl px-6 pb-10 pt-6">
            {reportStep === 'members' && (
              <>
                <ThemedText type="title" className="mb-1 text-lg">
                  Report a groupmate
                </ThemedText>
                <ThemedText type="default" themeColor="textSecondary" className="mb-4 text-sm">
                  This is sent privately to the founder.
                </ThemedText>
                <View className="gap-2">
                  {members
                    .filter((member) => member.id !== user?.id)
                    .map((member) => {
                      const alreadyReported = reportedIds.has(member.id);
                      return (
                        <Pressable
                          key={member.id}
                          onPress={() => !alreadyReported && chooseReportTarget(member)}
                          disabled={alreadyReported}
                          className="flex-row items-center justify-between rounded-xl bg-gray-100 px-4 py-3 disabled:opacity-50 dark:bg-gray-800"
                        >
                          <ThemedText>{member.full_name}</ThemedText>
                          <ThemedText type="default" themeColor="textSecondary" className="text-xs">
                            {alreadyReported ? 'Reported' : 'Report →'}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                </View>
                <Pressable onPress={closeReportSheet} className="mt-6 items-center">
                  <ThemedText type="default" themeColor="textSecondary">
                    Close
                  </ThemedText>
                </Pressable>
              </>
            )}

            {reportStep === 'reason' && reportTarget && (
              <>
                <ThemedText type="title" className="mb-1 text-lg">
                  Report {reportTarget.full_name}
                </ThemedText>
                <ThemedText type="default" themeColor="textSecondary" className="mb-4 text-sm">
                  What happened?
                </ThemedText>
                <View className="gap-2">
                  {REPORT_REASONS.map((reason) => (
                    <Pressable
                      key={reason}
                      onPress={() => setSelectedReason(reason)}
                      className={`rounded-xl border px-4 py-3 ${
                        selectedReason === reason
                          ? 'border-black bg-gray-100 dark:border-white dark:bg-gray-800'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <ThemedText>{reason}</ThemedText>
                    </Pressable>
                  ))}
                </View>
                {reportError ? (
                  <ThemedText type="default" themeColor="error" className="mt-3 text-sm">
                    {reportError}
                  </ThemedText>
                ) : null}
                <Pressable
                  onPress={handleSubmitReport}
                  disabled={!selectedReason || submittingReport}
                  className="mt-6 items-center rounded-full bg-black py-3 disabled:opacity-40 dark:bg-white"
                >
                  <ThemedText themeColor="invertedText" className="font-semibold">
                    {submittingReport ? 'Sending…' : 'Send report'}
                  </ThemedText>
                </Pressable>
                <Pressable onPress={() => setReportStep('members')} className="mt-3 items-center">
                  <ThemedText type="default" themeColor="textSecondary">
                    Back
                  </ThemedText>
                </Pressable>
              </>
            )}

            {reportStep === 'done' && (
              <>
                <ThemedText type="title" className="mb-1 text-lg">
                  Report sent
                </ThemedText>
                <ThemedText type="default" themeColor="textSecondary" className="mb-6 text-sm">
                  The founder will look into this. Thanks for telling us.
                </ThemedText>
                <Pressable
                  onPress={closeReportSheet}
                  className="items-center rounded-full bg-black py-3 dark:bg-white"
                >
                  <ThemedText themeColor="invertedText" className="font-semibold">
                    Done
                  </ThemedText>
                </Pressable>
              </>
            )}
          </ThemedView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
