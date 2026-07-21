/**
 * Workers & Datasets screen.
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
  useListWorkers,
  useListDatasets,
  useGetDatasetOverview,
  useGenerateDataset,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

type WorkerStatus = 'idle' | 'running' | 'paused' | 'error';
type DatasetStatus = 'ready' | 'generating' | 'cleaning';

function statusColor(s: WorkerStatus | DatasetStatus, colors: ReturnType<typeof useColors>) {
  switch (s) {
    case 'running': return colors.secondary;
    case 'idle': return colors.mutedForeground;
    case 'paused': return colors.primary;
    case 'error': return colors.destructive;
    case 'ready': return colors.secondary;
    case 'generating': return colors.primary;
    case 'cleaning': return colors.primary;
    default: return colors.mutedForeground;
  }
}

export default function WorkersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data: workers = [], isLoading: workersLoading } = useListWorkers(undefined, {
    query: { refetchInterval: 3_000 },
  });
  const { data: datasets = [], isLoading: datasetsLoading } = useListDatasets(undefined, {
    query: { refetchInterval: 8_000 },
  });
  const { data: overview } = useGetDatasetOverview(undefined, {
    query: { refetchInterval: 8_000 },
  });
  const generateDataset = useGenerateDataset();

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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Workers</Text>
        <View
          style={[
            styles.badge,
            { backgroundColor: colors.secondary + '15', borderColor: colors.secondary + '30' },
          ]}
        >
          <View style={[styles.dot, { backgroundColor: colors.secondary }]} />
          <Text style={[styles.badgeText, { color: colors.secondary }]}>
            {workers.filter((w) => (w as any).status === 'running').length} ACTIVE
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: bottomPad + 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Workers section */}
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Training Workers</Text>

        {workersLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : workers.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="server" size={24} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No workers</Text>
          </View>
        ) : (
          workers.map((w) => {
            const worker = w as any;
            const sc = statusColor(worker.status, colors);
            return (
              <View key={worker.id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <View style={styles.cardRow}>
                  <View style={[styles.workerIcon, { backgroundColor: sc + '15', borderColor: sc + '30' }]}>
                    <Feather name="cpu" size={14} color={sc} />
                  </View>
                  <View style={styles.workerInfo}>
                    <Text style={[styles.workerName, { color: colors.foreground }]}>{worker.name}</Text>
                    <Text style={[styles.workerType, { color: colors.mutedForeground }]}>
                      {worker.type}
                    </Text>
                  </View>
                  <View style={styles.workerRight}>
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: sc + '15', borderColor: sc + '30' },
                      ]}
                    >
                      <View style={[styles.dot, { backgroundColor: sc }]} />
                      <Text style={[styles.statusText, { color: sc }]}>
                        {worker.status.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.workerTps, { color: colors.mutedForeground }]}>
                      {worker.tokensPerSecond.toFixed(0)} t/s
                    </Text>
                  </View>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <View style={styles.workerStats}>
                  {[
                    { label: 'Processed', value: worker.processed.toLocaleString() },
                    { label: 'Queue', value: String(worker.queueSize) },
                    { label: 'Errors', value: String(worker.errors) },
                  ].map(({ label, value }) => (
                    <View key={label} style={styles.workerStat}>
                      <Text style={[styles.workerStatValue, { color: colors.foreground }]}>{value}</Text>
                      <Text style={[styles.workerStatLabel, { color: colors.mutedForeground }]}>{label}</Text>
                    </View>
                  ))}
                  {worker.currentTask && (
                    <View style={[styles.taskBox, { borderColor: colors.border, backgroundColor: colors.muted }]}>
                      <Text style={[styles.taskLabel, { color: colors.mutedForeground }]}>Task: </Text>
                      <Text style={[styles.taskText, { color: colors.foreground }]} numberOfLines={1}>
                        {worker.currentTask}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}

        {/* Datasets section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Datasets</Text>
          {overview && (
            <Text style={[styles.sectionMeta, { color: colors.mutedForeground }]}>
              {overview.totalSamples?.toLocaleString()} samples · {(overview.averageQuality ?? 0).toFixed(1)}% quality
            </Text>
          )}
        </View>

        {datasetsLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : datasets.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="database" size={24} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No datasets</Text>
          </View>
        ) : (
          datasets.map((d) => {
            const ds = d as any;
            const sc = statusColor(ds.status, colors);
            const sizeLabel =
              ds.sizeKb > 1024
                ? `${(ds.sizeKb / 1024).toFixed(1)} MB`
                : `${ds.sizeKb} KB`;

            return (
              <View key={ds.id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <View style={styles.cardRow}>
                  <View style={[styles.dsIcon, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
                    <Feather name="database" size={14} color={colors.primary} />
                  </View>
                  <View style={styles.workerInfo}>
                    <Text style={[styles.workerName, { color: colors.foreground }]}>
                      {ds.category}
                    </Text>
                    <Text style={[styles.workerType, { color: colors.mutedForeground }]}>
                      {ds.totalSamples.toLocaleString()} samples · {sizeLabel}
                    </Text>
                  </View>
                  <View style={styles.workerRight}>
                    <View style={[styles.statusPill, { backgroundColor: sc + '15', borderColor: sc + '30' }]}>
                      <View style={[styles.dot, { backgroundColor: sc }]} />
                      <Text style={[styles.statusText, { color: sc }]}>
                        {ds.status.toUpperCase()}
                      </Text>
                    </View>
                    <Pressable
                      style={[styles.genBtn, { borderColor: colors.border, backgroundColor: colors.muted }]}
                      onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        generateDataset.mutate({ data: { category: ds.category, count: 100 } });
                      }}
                      disabled={generateDataset.isPending}
                    >
                      <Feather name="refresh-cw" size={11} color={colors.primary} />
                    </Pressable>
                  </View>
                </View>

                {/* Quality bar */}
                <View style={[styles.qualityBar, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.qualityFill,
                      {
                        width: `${ds.qualityScore}%` as any,
                        backgroundColor: colors.primary,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.qualityLabel, { color: colors.mutedForeground }]}>
                  Quality: {ds.qualityScore.toFixed(1)}%
                </Text>
              </View>
            );
          })
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
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeText: { fontSize: 9, fontFamily: 'Inter_600SemiBold', letterSpacing: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionMeta: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  card: { borderRadius: 10, borderWidth: 1, padding: 12, gap: 8 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  workerIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  dsIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  workerInfo: { flex: 1, gap: 2 },
  workerName: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  workerType: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  workerRight: { alignItems: 'flex-end', gap: 4 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusText: { fontSize: 8, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8 },
  workerTps: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  divider: { height: 1 },
  workerStats: { flexDirection: 'row', gap: 12 },
  workerStat: { alignItems: 'center', gap: 2 },
  workerStatValue: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  workerStatLabel: { fontSize: 9, fontFamily: 'Inter_400Regular' },
  taskBox: {
    flexDirection: 'row',
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginLeft: 'auto',
    maxWidth: 160,
  },
  taskLabel: { fontSize: 9, fontFamily: 'Inter_400Regular' },
  taskText: { fontSize: 9, fontFamily: 'Inter_400Regular', flex: 1 },
  genBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qualityBar: { height: 3, borderRadius: 2, overflow: 'hidden' },
  qualityFill: { height: '100%', borderRadius: 2 },
  qualityLabel: { fontSize: 9, fontFamily: 'Inter_400Regular' },
  center: { paddingVertical: 40, alignItems: 'center' },
  empty: { paddingVertical: 40, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
});
