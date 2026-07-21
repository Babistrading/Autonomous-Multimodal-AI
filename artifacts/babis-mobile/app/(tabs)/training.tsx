/**
 * Training screen — server-side Babis M1 training + local on-device training.
 */

import React, { useCallback } from 'react';
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
import Svg, { Path, Defs, LinearGradient, Stop, Path as SvgPath } from 'react-native-svg';
import {
  useGetTrainingStatus,
  useGetTrainingMetrics,
  useStartTraining,
  useStopTraining,
  usePauseTraining,
  useResumeTraining,
  useSetPowerMode,
  useSaveCheckpoint,
} from '@workspace/api-client-react';
import { useLocalTraining } from '@/context/LocalTrainingContext';
import { useColors } from '@/hooks/useColors';

// ---------------------------------------------------------------------------
// Mini SVG loss chart
// ---------------------------------------------------------------------------
function LossChart({
  metrics,
  color,
  height = 64,
}: {
  metrics: { step: number; loss: number }[];
  color: string;
  height?: number;
}) {
  const WIDTH = 280;
  if (metrics.length < 2) {
    return <View style={{ width: WIDTH, height }} />;
  }

  const losses = metrics.map((m) => m.loss);
  const minL = Math.min(...losses);
  const maxL = Math.max(...losses);
  const range = maxL - minL || 0.1;
  const pad = 4;

  const pts = metrics.map((m, i) => {
    const x = pad + ((i / (metrics.length - 1)) * (WIDTH - pad * 2));
    const y = pad + ((1 - (m.loss - minL) / range) * (height - pad * 2));
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const linePath = `M ${pts.join(' L ')}`;
  const areaPath = `M ${pts[0]} L ${pts.join(' L ')} L ${(WIDTH - pad).toFixed(1)},${height} L ${pad},${height} Z`;

  return (
    <Svg width={WIDTH} height={height}>
      <Defs>
        <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.3" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <SvgPath d={areaPath} fill="url(#grad)" />
      <Path d={linePath} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Stat chip
// ---------------------------------------------------------------------------
function Stat({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.stat, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Power mode button
// ---------------------------------------------------------------------------
const POWER_MODES = ['low', 'medium', 'high', 'max'] as const;
type PowerMode = (typeof POWER_MODES)[number];

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function TrainingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const local = useLocalTraining();

  const { data: status } = useGetTrainingStatus(undefined, {
    query: { refetchInterval: 2_000 },
  });
  const { data: serverMetrics = [] } = useGetTrainingMetrics(
    { limit: 60 },
    { query: { refetchInterval: 4_000 } },
  );

  const startTraining = useStartTraining();
  const stopTraining = useStopTraining();
  const pauseTraining = usePauseTraining();
  const resumeTraining = useResumeTraining();
  const setPowerMode = useSetPowerMode();
  const saveCheckpoint = useSaveCheckpoint();

  const serverStatus = status?.status ?? 'idle';
  const serverRunning = serverStatus === 'running';
  const serverPaused = serverStatus === 'paused';

  const handleServerAction = useCallback(
    (action: 'start' | 'stop' | 'pause' | 'resume') => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (action === 'start') startTraining.mutate({});
      else if (action === 'stop') stopTraining.mutate({});
      else if (action === 'pause') pauseTraining.mutate({});
      else resumeTraining.mutate({});
    },
    [startTraining, stopTraining, pauseTraining, resumeTraining],
  );

  const handlePowerMode = useCallback(
    (mode: PowerMode) => {
      void Haptics.selectionAsync();
      setPowerMode.mutate({ data: { powerMode: mode } });
    },
    [setPowerMode],
  );

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 8, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Training</Text>
        <View style={styles.headerRight}>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: serverRunning
                  ? colors.secondary + '20'
                  : colors.card,
                borderColor: serverRunning
                  ? colors.secondary + '40'
                  : colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: serverRunning
                    ? colors.secondary
                    : serverPaused
                    ? colors.primary
                    : colors.mutedForeground,
                },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                {
                  color: serverRunning
                    ? colors.secondary
                    : serverPaused
                    ? colors.primary
                    : colors.mutedForeground,
                },
              ]}
            >
              {serverStatus.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          gap: 16,
          paddingBottom: bottomPad + 80,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── SERVER TRAINING ─────────────────────────────────────────── */}
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Feather name="server" size={14} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Server Training</Text>
              <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>Babis M1 · Replit VM</Text>
            </View>
            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                saveCheckpoint.mutate({});
              }}
              disabled={saveCheckpoint.isPending}
              style={[styles.smallBtn, { borderColor: colors.border, backgroundColor: colors.muted }]}
            >
              <Feather name="save" size={12} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <Stat label="STEP" value={(status?.step ?? 0).toLocaleString()} colors={colors} />
            <Stat label="EPOCH" value={String(status?.epoch ?? 0)} colors={colors} />
            <Stat label="LOSS" value={status?.loss?.toFixed(4) ?? '—'} colors={colors} />
            <Stat label="TPS" value={`${Math.floor(status?.tokensPerSecond ?? 0)}`} colors={colors} />
          </View>

          {/* Loss chart */}
          <View style={styles.chartWrapper}>
            <LossChart
              metrics={serverMetrics as { step: number; loss: number }[]}
              color={colors.primary}
            />
            <Text style={[styles.chartLabel, { color: colors.mutedForeground }]}>Loss curve</Text>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            {!serverRunning && !serverPaused ? (
              <Pressable
                style={[styles.ctrlBtn, { backgroundColor: colors.secondary + '20', borderColor: colors.secondary + '40' }]}
                onPress={() => handleServerAction('start')}
                disabled={startTraining.isPending}
              >
                {startTraining.isPending ? (
                  <ActivityIndicator size="small" color={colors.secondary} />
                ) : (
                  <Feather name="play" size={16} color={colors.secondary} />
                )}
                <Text style={[styles.ctrlText, { color: colors.secondary }]}>Start</Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  style={[styles.ctrlBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}
                  onPress={() => handleServerAction(serverPaused ? 'resume' : 'pause')}
                  disabled={pauseTraining.isPending || resumeTraining.isPending}
                >
                  <Feather name={serverPaused ? 'play' : 'pause'} size={16} color={colors.primary} />
                  <Text style={[styles.ctrlText, { color: colors.primary }]}>
                    {serverPaused ? 'Resume' : 'Pause'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.ctrlBtn, { backgroundColor: colors.destructive + '15', borderColor: colors.destructive + '30' }]}
                  onPress={() => handleServerAction('stop')}
                  disabled={stopTraining.isPending}
                >
                  <Feather name="square" size={16} color={colors.destructive} />
                  <Text style={[styles.ctrlText, { color: colors.destructive }]}>Stop</Text>
                </Pressable>
              </>
            )}
          </View>

          {/* Power mode */}
          <View style={styles.powerRow}>
            {POWER_MODES.map((mode) => {
              const active = status?.powerMode === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => handlePowerMode(mode)}
                  style={[
                    styles.powerBtn,
                    {
                      backgroundColor: active ? colors.primary + '20' : colors.muted,
                      borderColor: active ? colors.primary + '60' : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.powerText,
                      { color: active ? colors.primary : colors.mutedForeground },
                    ]}
                  >
                    {mode.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── LOCAL DEVICE TRAINING ────────────────────────────────────── */}
        <View style={[styles.card, { borderColor: local.running ? colors.secondary + '40' : colors.border, backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Feather name="smartphone" size={14} color={colors.secondary} />
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>On-Device Training</Text>
              <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>Adapter · {local.baseModel} base</Text>
            </View>
          </View>

          {/* Base model badge */}
          <View style={[styles.baseBadge, { borderColor: colors.border, backgroundColor: colors.muted }]}>
            <Feather name="layers" size={10} color={colors.mutedForeground} />
            <Text style={[styles.baseBadgeText, { color: colors.mutedForeground }]}>
              Base: {local.baseModel} (frozen) → Babis M1 adapter (training)
            </Text>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <Stat label="STEP" value={local.step.toLocaleString()} colors={colors} />
            <Stat label="EPOCH" value={String(local.epoch)} colors={colors} />
            <Stat label="LOSS" value={local.running ? local.loss.toFixed(4) : '—'} colors={colors} />
            <Stat label="TPS" value={local.running ? String(local.tokensPerSecond) : '—'} colors={colors} />
          </View>

          {/* Loss chart */}
          {local.metrics.length > 1 && (
            <View style={styles.chartWrapper}>
              <LossChart metrics={local.metrics} color={colors.secondary} />
              <Text style={[styles.chartLabel, { color: colors.mutedForeground }]}>Local adapter loss</Text>
            </View>
          )}

          {/* Current sample */}
          {local.running && local.currentSample ? (
            <View style={[styles.sampleBox, { borderColor: colors.border, backgroundColor: colors.muted }]}>
              <Text style={[styles.sampleLabel, { color: colors.mutedForeground }]}>Training on:</Text>
              <Text style={[styles.sampleText, { color: colors.foreground }]} numberOfLines={1}>
                {local.currentSample}
              </Text>
            </View>
          ) : null}

          {/* Controls */}
          <View style={styles.controls}>
            {!local.running ? (
              <Pressable
                style={[styles.ctrlBtn, { backgroundColor: colors.secondary + '20', borderColor: colors.secondary + '40' }]}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  local.start();
                }}
              >
                <Feather name="play" size={16} color={colors.secondary} />
                <Text style={[styles.ctrlText, { color: colors.secondary }]}>Start Local</Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  style={[styles.ctrlBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    local.togglePause();
                  }}
                >
                  <Feather name={local.paused ? 'play' : 'pause'} size={16} color={colors.primary} />
                  <Text style={[styles.ctrlText, { color: colors.primary }]}>
                    {local.paused ? 'Resume' : 'Pause'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.ctrlBtn, { backgroundColor: colors.destructive + '15', borderColor: colors.destructive + '30' }]}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    local.stop();
                  }}
                >
                  <Feather name="square" size={16} color={colors.destructive} />
                  <Text style={[styles.ctrlText, { color: colors.destructive }]}>Stop</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </ScrollView>
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
  headerTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 9, fontFamily: 'Inter_600SemiBold', letterSpacing: 1 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  cardTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  cardSub: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  smallBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: { flexDirection: 'row', gap: 6 },
  stat: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  statLabel: { fontSize: 8, fontFamily: 'Inter_400Regular', letterSpacing: 0.8 },
  chartWrapper: { gap: 4 },
  chartLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', letterSpacing: 0.5 },
  controls: { flexDirection: 'row', gap: 8 },
  ctrlBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  ctrlText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  powerRow: { flexDirection: 'row', gap: 4 },
  powerBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  powerText: { fontSize: 9, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8 },
  baseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  baseBadgeText: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  sampleBox: {
    borderRadius: 6,
    borderWidth: 1,
    padding: 8,
    gap: 2,
  },
  sampleLabel: { fontSize: 9, fontFamily: 'Inter_400Regular', letterSpacing: 0.5 },
  sampleText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
