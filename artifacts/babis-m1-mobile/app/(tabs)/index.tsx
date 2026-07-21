import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import {
  type ChatSession,
  type Message,
  createChatSession,
  deleteChatSession,
  fetchChatSessions,
  fetchMessages,
  sendMessage,
} from '@/lib/api';

// Module-level counter for unique IDs
let msgCounter = 0;
function uid() {
  msgCounter++;
  return `msg-${Date.now()}-${msgCounter}`;
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingDot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: delay }),
        withTiming(1, { duration: 350 }),
        withTiming(0.3, { duration: 350 }),
      ),
      -1,
    );
  }, [delay]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const colors = useColors();
  return (
    <Animated.View
      style={[styles.dot, { backgroundColor: colors.primary }, style]}
    />
  );
}

function TypingIndicator() {
  return (
    <View style={styles.typingRow}>
      <TypingDot delay={0} />
      <TypingDot delay={160} />
      <TypingDot delay={320} />
    </View>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const colors = useColors();
  const isUser = msg.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
      {!isUser && (
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={[styles.avatarText, { color: colors.primaryForeground }]}>B</Text>
        </View>
      )}
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isUser ? colors.primary : colors.card,
            borderRadius: colors.radius + 12,
            borderBottomRightRadius: isUser ? 4 : colors.radius + 12,
            borderBottomLeftRadius: isUser ? colors.radius + 12 : 4,
            borderWidth: isUser ? 0 : 1,
            borderColor: colors.border,
          },
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            { color: isUser ? colors.primaryForeground : colors.foreground },
          ]}
        >
          {msg.content}
        </Text>
      </View>
    </View>
  );
}

// ── Sessions drawer ───────────────────────────────────────────────────────────

function SessionsDrawer({
  sessions,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onClose,
}: {
  sessions: ChatSession[];
  activeId: number | null;
  onSelect: (s: ChatSession) => void;
  onNew: () => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.drawer, { backgroundColor: colors.card, paddingTop: insets.top + 16 }]}>
      <View style={styles.drawerHeader}>
        <Text style={[styles.drawerTitle, { color: colors.foreground }]}>Conversations</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <Feather name="x" size={22} color={colors.mutedForeground} />
        </Pressable>
      </View>
      <Pressable
        style={[styles.newChatBtn, { borderColor: colors.primary, borderRadius: colors.radius }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onNew(); onClose(); }}
      >
        <Feather name="plus" size={16} color={colors.primary} />
        <Text style={[styles.newChatText, { color: colors.primary }]}>New Chat</Text>
      </Pressable>
      <FlatList
        data={sessions}
        keyExtractor={(s) => String(s.id)}
        renderItem={({ item }) => (
          <Pressable
            style={[
              styles.sessionRow,
              activeId === item.id && { backgroundColor: colors.accent },
              { borderRadius: colors.radius },
            ]}
            onPress={() => { onSelect(item); onClose(); }}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.sessionTitle, { color: colors.foreground }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[styles.sessionMeta, { color: colors.mutedForeground }]}>
                {item.messageCount} messages
              </Text>
            </View>
            <Pressable
              onPress={() => {
                Alert.alert('Delete', 'Remove this conversation?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => onDelete(item.id) },
                ]);
              }}
              hitSlop={8}
            >
              <Feather name="trash-2" size={16} color={colors.mutedForeground} />
            </Pressable>
          </Pressable>
        )}
      />
    </View>
  );
}

// ── Main chat screen ─────────────────────────────────────────────────────────

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const inputRef = useRef<TextInput>(null);

  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: fetchChatSessions,
    staleTime: 5_000,
  });

  // Load messages when session changes
  const { data: serverMessages } = useQuery({
    queryKey: ['messages', sessionId],
    queryFn: () => (sessionId ? fetchMessages(sessionId) : Promise.resolve([])),
    enabled: sessionId !== null,
    staleTime: 0,
  });

  // Init: pick or create a session
  useEffect(() => {
    if (sessionsLoading) return;
    if (sessions.length > 0 && sessionId === null) {
      setSessionId(sessions[0].id);
    } else if (sessions.length === 0 && sessionId === null) {
      createChatSession().then((s) => {
        setSessionId(s.id);
        qc.invalidateQueries({ queryKey: ['sessions'] });
      });
    }
  }, [sessions, sessionsLoading]);

  // Sync messages from server (initial load only)
  const initializedRef = useRef(false);
  useEffect(() => {
    if (serverMessages && !initializedRef.current) {
      setMessages(serverMessages);
      initializedRef.current = true;
    }
  }, [serverMessages]);

  // Reset messages when switching sessions
  useEffect(() => {
    initializedRef.current = false;
    setMessages([]);
  }, [sessionId]);

  const sendMutation = useMutation({
    mutationFn: ({ sid, content }: { sid: number; content: string }) =>
      sendMessage(sid, content),
    onMutate: ({ content }) => {
      // Optimistically add user message
      const userMsg: Message = {
        id: -Date.now(),
        sessionId: sessionId!,
        role: 'user',
        content,
        thinkingMode: false,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsThinking(true);
    },
    onSuccess: (response) => {
      setIsThinking(false);
      // Replace optimistic + add assistant response
      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m.id > 0);
        return [...withoutOptimistic, response];
      });
      qc.invalidateQueries({ queryKey: ['sessions'] });
      qc.invalidateQueries({ queryKey: ['messages', sessionId] });
    },
    onError: () => {
      setIsThinking(false);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id > 0));
      Alert.alert('Error', 'Failed to send message. Check your connection.');
    },
  });

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || !sessionId || sendMutation.isPending) return;
    setInput('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendMutation.mutate({ sid: sessionId, content: text });
    inputRef.current?.focus();
  }, [input, sessionId, sendMutation]);

  const handleNewSession = useCallback(async () => {
    const s = await createChatSession();
    setSessionId(s.id);
    setMessages([]);
    initializedRef.current = false;
    qc.invalidateQueries({ queryKey: ['sessions'] });
  }, [qc]);

  const handleDeleteSession = useCallback(
    async (id: number) => {
      await deleteChatSession(id);
      qc.invalidateQueries({ queryKey: ['sessions'] });
      if (id === sessionId) {
        setSessionId(null);
        setMessages([]);
        initializedRef.current = false;
      }
    },
    [sessionId, qc],
  );

  const reversedMessages = [...messages].reverse();
  const activeSession = sessions.find((s) => s.id === sessionId);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable onPress={() => setShowDrawer(true)} hitSlop={12}>
          <Feather name="menu" size={22} color={colors.mutedForeground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
          {activeSession?.title ?? 'Babis M1'}
        </Text>
        <Pressable onPress={handleNewSession} hitSlop={12}>
          <Feather name="plus-square" size={22} color={colors.primary} />
        </Pressable>
      </View>

      {/* Sessions drawer overlay */}
      {showDrawer && (
        <Pressable style={styles.drawerOverlay} onPress={() => setShowDrawer(false)}>
          <Pressable onPress={() => {}}>
            <SessionsDrawer
              sessions={sessions}
              activeId={sessionId}
              onSelect={(s) => setSessionId(s.id)}
              onNew={handleNewSession}
              onDelete={handleDeleteSession}
              onClose={() => setShowDrawer(false)}
            />
          </Pressable>
        </Pressable>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        {/* Messages */}
        {messages.length === 0 && !isThinking ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.accent, borderRadius: 24 }]}>
              <Text style={[styles.emptyIconText, { color: colors.primary }]}>B</Text>
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Babis M1 is ready</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              Training in progress — responses improve over time
            </Text>
            <View style={styles.suggestionsRow}>
              {['Explain attention', 'What is BPE?', 'Solve ∫x·eˣ dx'].map((s) => (
                <Pressable
                  key={s}
                  style={[styles.suggestion, { borderColor: colors.border, borderRadius: colors.radius + 4 }]}
                  onPress={() => { setInput(s); inputRef.current?.focus(); }}
                >
                  <Text style={[styles.suggestionText, { color: colors.mutedForeground }]}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            data={reversedMessages}
            keyExtractor={(m) => String(m.id)}
            renderItem={({ item }) => <MessageBubble msg={item} />}
            inverted={messages.length > 0}
            ListHeaderComponent={isThinking ? <TypingIndicator /> : null}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Input bar */}
        <View
          style={[
            styles.inputBar,
            {
              paddingBottom: insets.bottom + 8,
              backgroundColor: colors.background,
              borderTopColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.inputWrap,
              { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius + 14 },
            ]}
          >
            <TextInput
              ref={inputRef}
              style={[styles.input, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
              placeholder="Message Babis M1…"
              placeholderTextColor={colors.mutedForeground}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={2000}
              blurOnSubmit={false}
              returnKeyType="send"
              onSubmitEditing={handleSend}
            />
            <Pressable
              style={[
                styles.sendBtn,
                {
                  backgroundColor: input.trim() && !sendMutation.isPending ? colors.primary : colors.muted,
                  borderRadius: colors.radius + 10,
                },
              ]}
              onPress={handleSend}
              disabled={!input.trim() || sendMutation.isPending}
            >
              {sendMutation.isPending ? (
                <ActivityIndicator size={16} color={colors.primaryForeground} />
              ) : (
                <Feather
                  name="send"
                  size={16}
                  color={input.trim() ? colors.primaryForeground : colors.mutedForeground}
                />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    ...(Platform.OS === 'web' ? { paddingTop: 67 } : {}),
  },
  headerTitle: { flex: 1, fontSize: 16, fontFamily: 'Inter_600SemiBold', textAlign: 'center', marginHorizontal: 12 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  emptyIcon: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyIconText: { fontSize: 36, fontFamily: 'Inter_700Bold' },
  emptyTitle: { fontSize: 20, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  suggestionsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8 },
  suggestion: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
  suggestionText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  messageList: { paddingHorizontal: 16, paddingVertical: 12 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, maxWidth: '85%' },
  bubbleRowLeft: { alignSelf: 'flex-start' },
  bubbleRowRight: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  avatarText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  bubble: { padding: 12, maxWidth: '100%' },
  bubbleText: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 24, paddingVertical: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  inputBar: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, ...(Platform.OS === 'web' ? { paddingBottom: 34 } : {}) },
  inputWrap: { flexDirection: 'row', alignItems: 'flex-end', borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, gap: 8 },
  input: { flex: 1, fontSize: 15, maxHeight: 120, lineHeight: 22 },
  sendBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  // Drawer
  drawerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100 },
  drawer: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 280, zIndex: 101, paddingHorizontal: 16 },
  drawerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  drawerTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  newChatBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 16 },
  newChatText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  sessionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10, marginBottom: 2 },
  sessionTitle: { fontSize: 14, fontFamily: 'Inter_500Medium', marginBottom: 2 },
  sessionMeta: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
