import React from 'react';
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import {
  fetchCheckpoints,
  fetchModelInfo,
  fetchTokenizerStats,
  loadCheckpoint,
  type Checkpoint,
  type ModelInfo,
  type TokenizerStats,
} from '@/lib/api';

function InfoRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius + 4 }]}>
      <Text style={[styles.cardTitle, { color: colors.foreground }]}>{title}</Text>
      {children}
    </View>
  );
}

function CheckpointRow({ cp, onLoad }: { cp: Checkpoint; onLoad: (id: number) => void }) {
  const colors = useColors();
  return (
    <View style={[styles.cpRow, { borderBottomColor: colors.border }]}>
      <View style={{ flex: 1 }}>
        <View style={styles.cpHeader}>
          <Text style={[styles.cpName, { color: colors.foreground }]} numberOfLines={1}>{cp.name}</Text>
          {cp.isActive && (
            <View style={[styles.activeBadge, { backgroundColor: colors.primary + '22', borderColor: colors.primary + '55' }]}>
              <Text style={[styles.activeBadgeText, { color: colors.primary }]}>ACTIVE</Text>
            </View>
          )}
        </View>
        <Text style={[styles.cpMeta, { color: colors.mutedForeground }]}>
          Step {cp.step.toLocaleString()} · Loss {cp.loss.toFixed(4)} · {cp.sizeMb.toFixed(1)} MB
        </Text>
      </View>
      {!cp.isActive && (
        <Pressable
          style={[styles.loadBtn, { borderColor: colors.primary, borderRadius: colors.radius }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onLoad(cp.id); }}
        >
          <Text style={[styles.loadBtnText, { color: colors.primary }]}>Load</Text>
        </Pressable>
      )}
    </View>
  );
}

function formatParam(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(0) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return String(n);
}

export default function ModelScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const { data: modelInfo, isLoading: infoLoading, refetch: refetchInfo } = useQuery<ModelInfo>({
    queryKey: ['model-info'],
    queryFn: fetchModelInfo,
    staleTime: 60_000,
  });

  const { data: tokenizerStats } = useQuery<TokenizerStats>({
    queryKey: ['tokenizer-stats'],
    queryFn: fetchTokenizerStats,
    staleTime: 60_000,
  });

  const { data: checkpoints = [] } = useQuery<Checkpoint[]>({
    queryKey: ['checkpoints'],
    queryFn: fetchCheckpoints,
    staleTime: 30_000,
  });

  const loadMutation = useMutation({
    mutationFn: loadCheckpoint,
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['checkpoints'] });
      qc.invalidateQueries({ queryKey: ['training-status'] });
      Alert.alert('Checkpoint loaded', 'Training will resume from this checkpoint.');
    },
    onError: () => Alert.alert('Error', 'Could not load checkpoint.'),
  });

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + 16 + (Platform.OS === 'web' ? 67 : 0),
          paddingBottom: insets.bottom + 24 + (Platform.OS === 'web' ? 34 : 0),
        },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={infoLoading}
          onRefresh={() => { refetchInfo(); qc.invalidateQueries({ queryKey: ['checkpoints'] }); }}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={[styles.screenTitle, { color: colors.foreground }]}>Model</Text>

      {modelInfo && (
        <SectionCard title="Architecture">
          <InfoRow label="Name" value={`${modelInfo.name} v${modelInfo.version}`} />
          <InfoRow label="Architecture" value={modelInfo.architecture} />
          <InfoRow label="Parameters" value={formatParam(modelInfo.parameters)} />
          <InfoRow label="Layers" value={String(modelInfo.layers)} />
          <InfoRow label="Attention heads" value={String(modelInfo.heads)} />
          <InfoRow label="d_model" value={String(modelInfo.dModel)} />
          <InfoRow label="d_ff" value={String(modelInfo.dFf)} />
          <InfoRow label="Max seq len" value={modelInfo.maxSeqLen.toLocaleString()} />
          <InfoRow label="Vocab size" value={modelInfo.vocabSize.toLocaleString()} />
          <InfoRow label="Memory" value={`${modelInfo.memoryMb.toFixed(0)} MB`} />
        </SectionCard>
      )}

      {tokenizerStats && (
        <SectionCard title="Tokenizer">
          <InfoRow label="Vocab size" value={tokenizerStats.vocabSize.toLocaleString()} />
          <InfoRow label="Tokens seen" value={tokenizerStats.totalTokensSeen.toLocaleString()} />
          <InfoRow label="Unique tokens" value={tokenizerStats.uniqueTokens.toLocaleString()} />
          <InfoRow label="Avg token length" value={tokenizerStats.averageTokenLength.toFixed(2)} />
          {tokenizerStats.mostFrequent.length > 0 && (
            <View style={{ marginTop: 10 }}>
              <Text style={[styles.freqTitle, { color: colors.mutedForeground }]}>Most frequent</Text>
              <View style={styles.freqRow}>
                {tokenizerStats.mostFrequent.slice(0, 8).map((t) => (
                  <View key={t.token} style={[styles.tokenPill, { backgroundColor: colors.accent, borderRadius: colors.radius + 2 }]}>
                    <Text style={[styles.tokenText, { color: colors.primary }]}>{JSON.stringify(t.token)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </SectionCard>
      )}

      {checkpoints.length > 0 && (
        <SectionCard title={`Checkpoints (${checkpoints.length})`}>
          {checkpoints.map((cp) => (
            <CheckpointRow
              key={cp.id}
              cp={cp}
              onLoad={(id) => {
                Alert.alert('Load checkpoint', `Restore model to step ${cp.step}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Load', onPress: () => loadMutation.mutate(id) },
                ]);
              }}
            />
          ))}
        </SectionCard>
      )}

      {checkpoints.length === 0 && !infoLoading && (
        <View style={styles.emptyState}>
          <Feather name="save" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No checkpoints saved yet</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Checkpoints appear here after training saves weights</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 16 },
  screenTitle: { fontSize: 28, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  card: { padding: 16, borderWidth: 1, gap: 0 },
  cardTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  infoLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  infoValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold', textAlign: 'right', flex: 1, marginLeft: 16 },
  freqTitle: { fontSize: 12, fontFamily: 'Inter_500Medium', marginBottom: 8 },
  freqRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tokenPill: { paddingHorizontal: 10, paddingVertical: 4 },
  tokenText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  cpRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
  cpHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cpName: { fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 },
  cpMeta: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  activeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  activeBadgeText: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0.6 },
  loadBtn: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
  loadBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  emptyState: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  emptyText: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  emptySub: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingHorizontal: 32 },
});
