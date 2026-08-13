import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { fetchMyGroups, fetchGroupMembers, MyGroupDetails, GroupMember } from '@/lib/groups';
import { formatSlotDateTime } from '@/lib/format';

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

  useFocusEffect(
    useCallback(() => {
      if (!groupId) return;
      let cancelled = false;

      const load = async () => {
        const [groups, memberList] = await Promise.all([fetchMyGroups(), fetchGroupMembers(groupId)]);
        if (cancelled) return;

        const thisGroup = groups.find((g) => g.group_id === groupId) ?? null;
        setGroup(thisGroup);
        setMembers(memberList);

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
          <ThemedText className="font-semibold">
            {group.activity_emoji} {group.activity_name}
          </ThemedText>
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
    </KeyboardAvoidingView>
  );
}
