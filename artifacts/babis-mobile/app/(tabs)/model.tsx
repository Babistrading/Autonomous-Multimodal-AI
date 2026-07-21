/**
 * Model screen — architecture info, tokenizer stats, agents, checkpoints.
 */

import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useGetModelInfo,
  useGetTokenizerStats,
  useListAgents,
  useListCheckpoints,
  useLoadCheckpoint,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

type AgentStatus = 'active' | 'idle' | 'thinking' | 'error';

function agentStatusColor(s: AgentStatus, colors: ReturnType<typeof useColors>) {
  switch (s) {
    case 'active': return colors.secondary;
    case 'thinking': return colors.primary;
    case 'idle': return colors.mutedForeground;
    case 'error': return colors.destructive;
  }
}

function SpecRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.specRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.specLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.specValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

export default function ModelScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data: modelInfo, isLoading: modelLoading } = useGetModelInfo(undefined, {
    query: { staleTime: 60_000 },
  });
  const { data: tokStats, isLoading: tokLoading } = useGetTokenizerStats(undefined, {
    query: { staleTime: 30_000 },
  });
  const { data: agents = [], isLoading: agentsLoading } = useListAgents(undefined, {
    query: { refetchInterval: 5_000 },
  });
  const { data: checkpoints = [], isLoading: cpLoading } = useListCheckpoints(undefined, {
    query: { staleTime: 15_000 },
  });

  const loadCheckpoint = useLoadCheckpoint();

  const model = modelInfo as any;
  const tok = tokStats as any;

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Model</Text>
        {model && (
          <View style={[styles.versionBadge, { borderColor: colors.primary + '40', backgroundColor: colors.primary + '15' }]}>
            <Text style={[styles.versionText, { color: colors.primary }]}>
              {model.name} {model.version}
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: bottomPad + 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Architecture ──────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Architecture</Text>

        {modelLoading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
        ) : model ? (
          <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
            {/* Param hero */}
            <View style={styles.paramHero}>
              <View style={styles.paramLeft}>
                <Text style={[styles.paramCount, { color: colors.primary }]}>
                  {(model.parameters / 1_000_000).toFixed(0)}M
                </Text>
                <Text style={[styles.paramLabel, { color: colors.mutedForeground }]}>parameters</Text>
              </View>
              <View style={[styles.archBadge, { borderColor: colors.border, backgroundColor: colors.muted }]}>
                <Text style={[styles.archText, { color: colors.foreground }]}>{model.architecture}</Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <SpecRow label="Layers" value={String(model.layers)} colors={colors} />
            <SpecRow label="Attention Heads" value={String(model.heads)} colors={colors} />
            <SpecRow label="d_model" value={String(model.dModel)} colors={colors} />
            <SpecRow label="d_ff" value={String(model.dFf)} colors={colors} />
            <SpecRow label="Vocab Size" value={model.vocabSize.toLocaleString()} colors={colors} />
            <SpecRow label="Max Seq Length" value={String(model.maxSeqLen)} colors={colors} />
            <SpecRow label="Memory" value={`${model.memoryMb.toFixed(0)} MB`} colors={colors} />
          </View>
        ) : null}

        {/* ── Tokenizer ──────────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>BPE Tokenizer</Text>

        {tokLoading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
        ) : tok ? (
          <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <View style={styles.tokRow}>
              {[
                { label: 'Vocab', value: tok.vocabSize?.toLocaleString() ?? '—' },
                { label: 'Seen', value: tok.totalTokensSeen ? `${(tok.totalTokensSeen / 1_000_000).toFixed(1)}M` : '—' },
                { label: 'Avg len', value: tok.averageTokenLength?.toFixed(1) ?? '—' },
              ].map(({ label, value }) => (
                <View key={label} style={[styles.tokStat, { borderColor: colors.border, backgroundColor: colors.muted }]}>
                  <Text style={[styles.tokValue, { color: colors.foreground }]}>{value}</Text>
                  <Text style={[styles.tokLabel, { color: colors.mutedForeground }]}>{label}</Text>
                </View>
              ))}
            </View>

            {tok.mostFrequent?.length > 0 && (
              <>
                <Text style={[styles.subLabel, { color: colors.mutedForeground }]}>Most frequent tokens</Text>
                <View style={styles.tokenChips}>
                  {tok.mostFrequent.slice(0, 10).map((t: any, i: number) => (
                    <View
                      key={i}
                      style={[styles.tokenChip, { borderColor: colors.border, backgroundColor: colors.muted }]}
                    >
                      <Text style={[styles.tokenChipText, { color: colors.foreground }]}>
                        {JSON.stringify(t.token)}
                      </Text>
                      <Text style={[styles.tokenChipCount, { color: colors.mutedForeground }]}>
                        {t.count.toLocaleString()}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        ) : null}

        {/* ── Agents ─────────────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>AI Agents</Text>

        {agentsLoading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
        ) : agents.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="cpu" size={20} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No agents</Text>
          </View>
        ) : (
          (agents as any[]).map((a) => {
            const sc = agentStatusColor(a.status, colors);
            return (
              <View key={a.id} style={[styles.card, styles.agentCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <View style={[styles.agentIcon, { backgroundColor: sc + '15', borderColor: sc + '30' }]}>
                  <Feather name="zap" size={14} color={sc} />
                </View>
                <View style={styles.agentInfo}>
                  <View style={styles.agentNameRow}>
                    <Text style={[styles.agentName, { color: colors.foreground }]}>{a.name}</Text>
                    <View style={[styles.agentStatusPill, { backgroundColor: sc + '15', borderColor: sc + '30' }]}>
                      <View style={[styles.dot, { backgroundColor: sc }]} />
                      <Text style={[styles.agentStatusText, { color: sc }]}>{a.status.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={[styles.agentType, { color: colors.mutedForeground }]}>{a.type}</Text>
                  <Text style={[styles.agentAction, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {a.lastAction}
                  </Text>
                </View>
                <Text style={[styles.taskCount, { color: colors.mutedForeground }]}>{a.taskCount}</Text>
              </View>
            );
          })
        )}

        {/* ── Checkpoints ────────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Checkpoints</Text>

        {cpLoading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
        ) : checkpoints.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="save" size={20} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No checkpoints</Text>
          </View>
        ) : (
          (checkpoints as any[]).map((cp) => (
            <View
              key={cp.id}
              style={[
                styles.card,
                styles.cpCard,
                {
                  borderColor: cp.isActive ? colors.primary + '50' : colors.border,
                  backgroundColor: cp.isActive ? colors.primary + '08' : colors.card,
                },
              ]}
            >
              <View style={styles.cpLeft}>
                <Feather
                  name="save"
                  size={14}
                  color={cp.isActive ? colors.primary : colors.mutedForeground}
                />
                <View>
                  <Text style={[styles.cpName, { color: colors.foreground }]}>{cp.name}</Text>
                  <Text style={[styles.cpMeta, { color: colors.mutedForeground }]}>
                    Step {cp.step.toLocaleString()} · Loss {cp.loss.toFixed(3)} · {cp.sizeMb.toFixed(1)} MB
                  </Text>
                </View>
              </View>
              {!cp.isActive && (
                <Pressable
                  style={[styles.loadBtn, { borderColor: colors.border, backgroundColor: colors.muted }]}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    loadCheckpoint.mutate({ checkpointId: cp.id });
                  }}
                  disabled={loadCheckpoint.isPending}
                >
                  {loadCheckpoint.isPending ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Feather name="upload" size={13} color={colors.primary} />
                  )}
                </Pressable>
              )}
              {cp.isActive && (
                <View style={[styles.activeBadge, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '40' }]}>
                  <Text style={[styles.activeText, { color: colors.primary }]}>ACTIVE</Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

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
  headerTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  versionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  versionText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  card: { borderRadius: 10, borderWidth: 1, padding: 12, gap: 8 },
  paramHero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  paramLeft: { gap: 2 },
  paramCount: { fontSize: 32, fontFamily: 'Inter_700Bold' },
  paramLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  archBadge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  archText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  divider: { height: 1 },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  specLabel: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  specValue: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  tokRow: { flexDirection: 'row', gap: 6 },
  tokStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 2,
  },
  tokValue: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  tokLabel: { fontSize: 9, fontFamily: 'Inter_400Regular' },
  subLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8 },
  tokenChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tokenChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  tokenChipText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  tokenChipCount: { fontSize: 9, fontFamily: 'Inter_400Regular' },
  agentCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  agentIcon: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  agentInfo: { flex: 1, gap: 2 },
  agentNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  agentName: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  agentStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  agentStatusText: { fontSize: 8, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 },
  agentType: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  agentAction: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  taskCount: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  cpCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cpLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  cpName: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  cpMeta: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 2 },
  loadBtn: { width: 30, height: 30, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  activeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  activeText: { fontSize: 8, fontFamily: 'Inter_700Bold', letterSpacing: 0.8 },
  center: { paddingVertical: 30, alignItems: 'center' },
  empty: { paddingVertical: 30, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
});
