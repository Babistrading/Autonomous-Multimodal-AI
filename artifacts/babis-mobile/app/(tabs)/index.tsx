/**
 * Chat screen — talk to Babis M1 (model running on the API server).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListChatSessionsQueryKey,
  getListMessagesQueryKey,
  useCreateChatSession,
  useDeleteChatSession,
  useGetTrainingStatus,
  useListChatSessions,
  useListMessages,
  useSendMessage,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Session {
  id: number;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: number;
  sessionId: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinkingMode?: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Chat bubble
// ---------------------------------------------------------------------------
function ChatBubble({ message, colors }: { message: Message; colors: ReturnType<typeof useColors> }) {
  const isUser = message.role === 'user';
  return (
    <View
      style={[
        styles.bubbleWrapper,
        isUser ? styles.bubbleWrapperUser : styles.bubbleWrapperAssistant,
      ]}
    >
      {!isUser && (
        <View style={[styles.avatar, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '40' }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>B</Text>
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser
            ? { backgroundColor: colors.primary + '18', borderColor: colors.primary + '30' }
            : { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.bubbleText, { color: colors.foreground }]}>
          {message.content}
        </Text>
        <Text style={[styles.bubbleTime, { color: colors.mutedForeground }]}>
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sessions modal
// ---------------------------------------------------------------------------
import { Modal } from 'react-native';

function SessionsModal({
  visible,
  onClose,
  sessions,
  activeId,
  onSelect,
  onCreate,
  onDelete,
  creating,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  sessions: Session[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onCreate: () => void;
  onDelete: (id: number) => void;
  creating: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[
            styles.modalSheet,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: insets.bottom + 16,
            },
          ]}
          onPress={() => {}}
        >
          {/* Handle */}
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Conversations</Text>
            <Pressable
              style={[styles.newBtn, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '40' }]}
              onPress={onCreate}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather name="plus" size={18} color={colors.primary} />
              )}
            </Pressable>
          </View>

          {/* List */}
          <FlatList
            data={sessions}
            keyExtractor={(s) => String(s.id)}
            style={{ maxHeight: 360 }}
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.sessionItem,
                  {
                    borderBottomColor: colors.border,
                    backgroundColor: item.id === activeId ? colors.primary + '10' : 'transparent',
                  },
                ]}
                onPress={() => {
                  onSelect(item.id);
                  onClose();
                }}
              >
                <View style={styles.sessionItemLeft}>
                  <Feather
                    name="message-circle"
                    size={14}
                    color={item.id === activeId ? colors.primary : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.sessionTitle,
                      { color: item.id === activeId ? colors.primary : colors.foreground },
                    ]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                </View>
                <Pressable
                  hitSlop={12}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onDelete(item.id);
                  }}
                >
                  <Feather name="trash-2" size={14} color={colors.mutedForeground} />
                </Pressable>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No conversations yet
              </Text>
            }
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [showSessions, setShowSessions] = useState(false);
  const [pendingUserMsg, setPendingUserMsg] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: sessions = [] } = useListChatSessions(undefined, {
    query: { refetchInterval: 10_000 },
  });

  const { data: messages = [], isFetching: msgLoading } = useListMessages(
    activeSessionId!,
    { query: { enabled: !!activeSessionId, refetchInterval: 0 } },
  );

  const { data: trainingStatus } = useGetTrainingStatus(undefined, {
    query: { refetchInterval: 5_000 },
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createSession = useCreateChatSession();
  const deleteSession = useDeleteChatSession();
  const sendMessage = useSendMessage();

  // ── Auto-select / auto-create session ────────────────────────────────────
  useEffect(() => {
    if (sessions.length > 0 && !activeSessionId) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  useEffect(() => {
    if (sessions.length === 0 && !createSession.isPending) {
      createSession.mutate(
        { data: { title: 'Babis M1 — Chat' } },
        {
          onSuccess: (s) => {
            setActiveSessionId(s.id);
            void qc.invalidateQueries({ queryKey: getListChatSessionsQueryKey() });
          },
        },
      );
    }
  }, [sessions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleNewChat = useCallback(() => {
    createSession.mutate(
      { data: { title: 'New Chat' } },
      {
        onSuccess: (s) => {
          setActiveSessionId(s.id);
          setShowSessions(false);
          void qc.invalidateQueries({ queryKey: getListChatSessionsQueryKey() });
        },
      },
    );
  }, [createSession, qc]);

  const handleDeleteSession = useCallback(
    (id: number) => {
      deleteSession.mutate(
        { sessionId: id },
        {
          onSuccess: () => {
            if (activeSessionId === id) {
              const remaining = sessions.filter((s) => s.id !== id);
              setActiveSessionId(remaining[0]?.id ?? null);
            }
            void qc.invalidateQueries({ queryKey: getListChatSessionsQueryKey() });
          },
        },
      );
    },
    [deleteSession, activeSessionId, sessions, qc],
  );

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || !activeSessionId || sendMessage.isPending) return;

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput('');
    setPendingUserMsg(trimmed);

    sendMessage.mutate(
      { sessionId: activeSessionId, data: { content: trimmed, thinkingMode: false } },
      {
        onSuccess: () => {
          setPendingUserMsg(null);
          void qc.invalidateQueries({ queryKey: getListMessagesQueryKey(activeSessionId) });
          void qc.invalidateQueries({ queryKey: getListChatSessionsQueryKey() });
          inputRef.current?.focus();
        },
        onError: () => {
          setPendingUserMsg(null);
        },
      },
    );
  }, [input, activeSessionId, sendMessage, qc]);

  // ── Displayed messages (server + optimistic) ─────────────────────────────
  const displayMessages: Message[] = [
    ...(messages as Message[]),
    ...(pendingUserMsg
      ? [
          {
            id: -1,
            sessionId: activeSessionId ?? 0,
            role: 'user' as const,
            content: pendingUserMsg,
            createdAt: new Date().toISOString(),
          },
        ]
      : []),
  ];
  const invertedData = [...displayMessages].reverse();

  const isTraining = trainingStatus?.status === 'running';
  const activeSession = sessions.find((s) => s.id === activeSessionId);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 8,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Pressable style={styles.sessionSelector} onPress={() => setShowSessions(true)}>
          <View style={[styles.logo, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.logoText, { color: colors.primary }]}>B</Text>
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>BABIS M1</Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]} numberOfLines={1}>
              {activeSession?.title ?? 'No session'}
            </Text>
          </View>
          <Feather name="chevron-down" size={14} color={colors.mutedForeground} style={{ marginLeft: 4 }} />
        </Pressable>

        <View style={styles.headerRight}>
          {isTraining && (
            <View style={[styles.trainingBadge, { backgroundColor: colors.secondary + '20', borderColor: colors.secondary + '40' }]}>
              <View style={[styles.dot, { backgroundColor: colors.secondary }]} />
              <Text style={[styles.trainingText, { color: colors.secondary }]}>TRAINING</Text>
            </View>
          )}
          <Pressable
            style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleNewChat}
            disabled={createSession.isPending}
          >
            {createSession.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Feather name="edit-3" size={16} color={colors.mutedForeground} />
            )}
          </Pressable>
        </View>
      </View>

      {/* ── Messages ───────────────────────────────────────────────────── */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        {msgLoading && displayMessages.length === 0 ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : displayMessages.length === 0 ? (
          <View style={styles.centerState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
              <Text style={[styles.emptyIconText, { color: colors.primary }]}>B</Text>
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Babis M1 is ready</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              {isTraining ? 'Training in progress — responses improve over time' : 'Start a conversation'}
            </Text>
            {['What can you do?', 'Explain attention mechanisms', 'Write a Python function'].map((q) => (
              <Pressable
                key={q}
                style={[styles.suggestion, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => setInput(q)}
              >
                <Text style={[styles.suggestionText, { color: colors.mutedForeground }]}>{q}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <FlatList
            data={invertedData}
            keyExtractor={(m) => String(m.id)}
            inverted
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16 }}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => <ChatBubble message={item as Message} colors={colors} />}
            ListHeaderComponent={
              sendMessage.isPending ? (
                <View style={[styles.thinkingBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.thinkingDots}>
                    {[0, 1, 2].map((i) => (
                      <View key={i} style={[styles.thinkingDot, { backgroundColor: colors.primary }]} />
                    ))}
                  </View>
                </View>
              ) : null
            }
          />
        )}

        {/* ── Input bar ──────────────────────────────────────────────── */}
        <View
          style={[
            styles.inputBar,
            {
              borderTopColor: colors.border,
              backgroundColor: colors.background,
              paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 8),
            },
          ]}
        >
          <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              ref={inputRef}
              style={[styles.textInput, { color: colors.foreground }]}
              placeholder="Message Babis M1…"
              placeholderTextColor={colors.mutedForeground}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={2000}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              blurOnSubmit={false}
            />
            <Pressable
              style={[
                styles.sendBtn,
                {
                  backgroundColor:
                    input.trim() && activeSessionId && !sendMessage.isPending
                      ? colors.primary
                      : colors.border,
                },
              ]}
              onPress={handleSend}
              disabled={!input.trim() || !activeSessionId || sendMessage.isPending}
            >
              <Feather
                name="arrow-up"
                size={16}
                color={input.trim() && activeSessionId ? colors.primaryForeground : colors.mutedForeground}
              />
            </Pressable>
          </View>
          <Text style={[styles.inputHint, { color: colors.mutedForeground }]}>
            Step {trainingStatus?.step?.toLocaleString() ?? '—'} · Loss{' '}
            {trainingStatus?.loss?.toFixed(3) ?? '—'}
          </Text>
        </View>
      </KeyboardAvoidingView>

      {/* ── Sessions modal ──────────────────────────────────────────── */}
      <SessionsModal
        visible={showSessions}
        onClose={() => setShowSessions(false)}
        sessions={sessions as Session[]}
        activeId={activeSessionId}
        onSelect={setActiveSessionId}
        onCreate={handleNewChat}
        onDelete={handleDeleteSession}
        creating={createSession.isPending}
        colors={colors}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  sessionSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  headerTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  headerSub: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trainingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  trainingText: { fontSize: 9, fontFamily: 'Inter_600SemiBold', letterSpacing: 1 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 8,
  },
  emptyIconText: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  emptySubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', marginBottom: 8 },
  suggestion: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 4,
  },
  suggestionText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  bubbleWrapper: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end', gap: 8 },
  bubbleWrapperUser: { justifyContent: 'flex-end' },
  bubbleWrapperAssistant: { justifyContent: 'flex-start' },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  avatarText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  bubbleText: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  bubbleTime: { fontSize: 10, fontFamily: 'Inter_400Regular', alignSelf: 'flex-end' },
  thinkingBubble: {
    alignSelf: 'flex-start',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  thinkingDots: { flexDirection: 'row', gap: 4, alignItems: 'center', height: 20 },
  thinkingDot: { width: 6, height: 6, borderRadius: 3, opacity: 0.7 },
  inputBar: { paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 14,
    borderWidth: 1,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    maxHeight: 120,
    lineHeight: 20,
    paddingTop: 4,
    paddingBottom: 4,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputHint: { fontSize: 10, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 6 },
  // Sessions modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  newBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  sessionItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  sessionTitle: { fontSize: 14, fontFamily: 'Inter_400Regular', flex: 1 },
  emptyText: { textAlign: 'center', fontSize: 13, fontFamily: 'Inter_400Regular', paddingVertical: 20 },
});
