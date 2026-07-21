import React, { useCallback } from 'react';
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
  fetchTrainingMetrics,
  fetchTrainingStatus,
  fetchWorkers,
  pauseTraining,
  resumeTraining,
  saveCheckpoint,
  setPowerMode,
  type TrainingMetric,
  type TrainingStatus,
  type Worker,
} from '@/lib/api';

// ── Sparkline ─────────────────────────────────────────────────────────────────

function LossSparkline({ data }: { data: TrainingMetric[] }) {
  const colors = useColors();
  if (data.length < 2) return null;
  const losses = data.map((m) => m.loss);
  const min = Math.min(...losses);
  const max = Math.max(...losses);
  const range = max - min || 1;
  const height = 48;
  const barWidth = 3;
  const gap = 1;

  return (
    <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap }}>
      {losses.map((l, i) => {
        const h = Math.max(2, ((max - l) / range) * (height - 4) + 4);
        return (
          <View
            key={i}
            style={{
              width: barWidth,
              height: h,
              backgroundColor: colors.primary,
              borderRadius: 1,
              opacity: 0.4 + 0.6 * (i / losses.length),
            }}
          />
        );
      })}
    </View>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors = useColors();
  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const color = isRunning ? colors.secondary : isPaused ? '#f5a623' : colors.mutedForeground;
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
      <View style={[styles.badgeDot, { backgroundColor: color }]} />
      <Text style={[styles.badgeText, { color }]}>{status.toUpperCase()}</Text>
    </View>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const colors = useColors();
  return (
    <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius + 4 }]}>
      <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: colors.primary }]}>{value}</Text>
      {sub && <Text style={[styles.metricSub, { color: colors.mutedForeground }]}>{sub}</Text>}
    </View>
  );
}

// ── Worker row ────────────────────────────────────────────────────────────────

function WorkerRow({ w }: { w: Worker }) {
  const colors = useColors();
  const statusColor =
    w.status === 'running' ? colors.secondary :
    w.status === 'paused' ? '#f5a623' :
    w.status === 'error' ? colors.destructive :
    colors.mutedForeground;
  return (
    <View style={[styles.workerRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.workerDot, { backgroundColor: statusColor }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.workerName, { color: colors.foreground }]} numberOfLines={1}>{w.name}</Text>
        {w.currentTask && (
          <Text style={[styles.workerTask, { color: colors.mutedForeground }]} numberOfLines={1}>{w.currentTask}</Text>
        )}
      </View>
      <Text style={[styles.workerTps, { color: colors.primary }]}>{w.tokensPerSecond.toFixed(0)} t/s</Text>
    </View>
  );
}

// ── Power mode selector ───────────────────────────────────────────────────────

const POWER_MODES = ['low', 'medium', 'high', 'max'] as const;
const POWER_COLORS: Record<string, string> = { low: '#8a91a8', medium: '#f5a623', high: '#00d4ff', max: '#00ff88' };

function PowerModeRow({ current, onChange }: { current: string; onChange: (m: string) => void }) {
  const colors = useColors();
  return (
    <View style={styles.powerRow}>
      {POWER_MODES.map((m) => {
        const active = current === m;
        const c = POWER_COLORS[m];
        return (
          <Pressable
            key={m}
            style={[
              styles.powerBtn,
              {
                backgroundColor: active ? c + '33' : colors.card,
                borderColor: active ? c : colors.border,
                borderRadius: colors.radius + 2,
              },
            ]}
            onPress={() => { Haptics.selectionAsync(); onChange(m); }}
          >
            <Text style={[styles.powerBtnText, { color: active ? c : colors.mutedForeground }]}>
              {m.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

function formatSeconds(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatLoss(l: number | null | undefined) {
  if (l == null) return '—';
  return l.toFixed(4);
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return String(n);
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useQuery<TrainingStatus>({
    queryKey: ['training-status'],
    queryFn: fetchTrainingStatus,
    refetchInterval: 3_000,
    staleTime: 2_000,
  });

  const { data: metrics = [] } = useQuery<TrainingMetric[]>({
    queryKey: ['training-metrics'],
    queryFn: () => fetchTrainingMetrics(60),
    refetchInterval: 10_000,
    staleTime: 8_000,
  });

  const { data: workers = [] } = useQuery<Worker[]>({
    queryKey: ['workers'],
    queryFn: fetchWorkers,
    refetchInterval: 5_000,
    staleTime: 4_000,
  });

  const pauseMutation = useMutation({
    mutationFn: pauseTraining,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training-status'] }),
    onError: () => Alert.alert('Error', 'Could not pause training.'),
  });

  const resumeMutation = useMutation({
    mutationFn: resumeTraining,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training-status'] }),
    onError: () => Alert.alert('Error', 'Could not resume training.'),
  });

  const powerMutation = useMutation({
    mutationFn: (mode: string) => setPowerMode(mode),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training-status'] }),
  });

  const checkpointMutation = useMutation({
    mutationFn: saveCheckpoint,
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Checkpoint saved', 'Model weights have been persisted.');
    },
    onError: () => Alert.alert('Error', 'Could not save checkpoint.'),
  });

  const handleToggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (status?.status === 'running') pauseMutation.mutate();
    else resumeMutation.mutate();
  }, [status?.status]);

  const isRunning = status?.status === 'running';
  const recentMetrics = metrics.slice(-50);

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
          refreshing={statusLoading}
          onRefresh={() => { refetchStatus(); qc.invalidateQueries({ queryKey: ['workers'] }); }}
          tintColor={colors.primary}
        />
      }
    >
      {/* Status row */}
      <View style={styles.statusRow}>
        <View>
          <Text style={[styles.screenTitle, { color: colors.foreground }]}>Training</Text>
          {status && <StatusBadge status={status.status} />}
        </View>
        <View style={styles.statusActions}>
          <Pressable
            style={[styles.iconBtn, { backgroundColor: colors.accent, borderRadius: colors.radius + 4 }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); checkpointMutation.mutate(); }}
            disabled={checkpointMutation.isPending}
          >
            <Feather name="save" size={18} color={colors.primary} />
          </Pressable>
          <Pressable
            style={[
              styles.toggleBtn,
              {
                backgroundColor: isRunning ? colors.destructive + '22' : colors.secondary + '22',
                borderColor: isRunning ? colors.destructive : colors.secondary,
                borderRadius: colors.radius + 4,
              },
            ]}
            onPress={handleToggle}
            disabled={pauseMutation.isPending || resumeMutation.isPending}
          >
            <Feather
              name={isRunning ? 'pause' : 'play'}
              size={16}
              color={isRunning ? colors.destructive : colors.secondary}
            />
            <Text style={[styles.toggleText, { color: isRunning ? colors.destructive : colors.secondary }]}>
              {isRunning ? 'Pause' : 'Resume'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Metrics grid */}
      <View style={styles.metricsGrid}>
        <MetricCard label="STEP" value={status ? status.step.toLocaleString() : '—'} />
        <MetricCard label="LOSS" value={formatLoss(status?.loss)} />
        <MetricCard label="EPOCH" value={status ? String(status.epoch) : '—'} />
        <MetricCard label="TPS" value={status ? status.tokensPerSecond.toFixed(1) : '—'} sub="tokens/sec" />
        <MetricCard label="TOKENS" value={status ? formatTokens(status.tokensProcessed) : '—'} sub="processed" />
        <MetricCard label="UPTIME" value={status ? formatSeconds(status.trainingTimeSeconds) : '—'} />
      </View>

      {/* Sparkline */}
      {recentMetrics.length > 2 && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius + 4 }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Loss curve</Text>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
              last {recentMetrics.length} steps
            </Text>
          </View>
          <LossSparkline data={recentMetrics} />
        </View>
      )}

      {/* Power mode */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius + 4 }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Power mode</Text>
        <PowerModeRow
          current={powerMutation.variables ?? status?.powerMode ?? 'max'}
          onChange={(m) => powerMutation.mutate(m)}
        />
      </View>

      {/* Workers */}
      {workers.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius + 4 }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Workers</Text>
          {workers.map((w) => <WorkerRow key={w.id} w={w} />)}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 },
  screenTitle: { fontSize: 28, fontFamily: 'Inter_700Bold', marginBottom: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, alignSelf: 'flex-start' },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8 },
  statusActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1 },
  toggleText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '30%', flex: 1, minWidth: 90, padding: 14, borderWidth: 1 },
  metricLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8, marginBottom: 6 },
  metricValue: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  metricSub: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 2 },
  section: { padding: 16, borderWidth: 1, gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  sectionSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  workerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  workerDot: { width: 8, height: 8, borderRadius: 4 },
  workerName: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  workerTask: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  workerTps: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  powerRow: { flexDirection: 'row', gap: 8 },
  powerBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderWidth: 1 },
  powerBtnText: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.6 },
});
