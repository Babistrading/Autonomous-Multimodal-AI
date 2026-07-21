import React from 'react';
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { fetchHardwareMetrics, type HardwareMetrics } from '@/lib/api';

function GaugeBar({ value, max, color }: { value: number; max: number; color: string }) {
  const colors = useColors();
  const pct = Math.min(1, value / max);
  return (
    <View style={[styles.gaugeTrack, { backgroundColor: colors.muted, borderRadius: 3 }]}>
      <View style={[styles.gaugeFill, { width: `${pct * 100}%` as any, backgroundColor: color, borderRadius: 3 }]} />
    </View>
  );
}

function HardwareCard({ hw }: { hw: HardwareMetrics }) {
  const colors = useColors();
  const ramPct = (hw.ramUsedMb / hw.ramTotalMb) * 100;
  const storagePct = ((hw.storageTotalMb - hw.storageFreeMb) / hw.storageTotalMb) * 100;
  const uptime = hw.uptimeSeconds;
  const hours = Math.floor(uptime / 3600);
  const mins = Math.floor((uptime % 3600) / 60);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius + 4 }]}>
      <Text style={[styles.cardTitle, { color: colors.foreground }]}>Hardware</Text>

      <View style={styles.hardwareRow}>
        <Text style={[styles.hwLabel, { color: colors.mutedForeground }]}>CPU</Text>
        <GaugeBar value={hw.cpuUsagePercent} max={100} color={hw.cpuUsagePercent > 80 ? '#f5a623' : colors.primary} />
        <Text style={[styles.hwValue, { color: colors.foreground }]}>{hw.cpuUsagePercent.toFixed(0)}%</Text>
      </View>

      <View style={styles.hardwareRow}>
        <Text style={[styles.hwLabel, { color: colors.mutedForeground }]}>RAM</Text>
        <GaugeBar value={hw.ramUsedMb} max={hw.ramTotalMb} color={ramPct > 80 ? '#ff3333' : colors.primary} />
        <Text style={[styles.hwValue, { color: colors.foreground }]}>
          {(hw.ramUsedMb / 1024).toFixed(1)}/{(hw.ramTotalMb / 1024).toFixed(1)} GB
        </Text>
      </View>

      <View style={styles.hardwareRow}>
        <Text style={[styles.hwLabel, { color: colors.mutedForeground }]}>Disk</Text>
        <GaugeBar value={hw.storageTotalMb - hw.storageFreeMb} max={hw.storageTotalMb} color={colors.secondary} />
        <Text style={[styles.hwValue, { color: colors.foreground }]}>
          {(hw.storageFreeMb / 1024).toFixed(0)} GB free
        </Text>
      </View>

      <View style={[styles.hwStats, { borderTopColor: colors.border }]}>
        <View style={styles.hwStat}>
          <Text style={[styles.hwStatValue, { color: colors.primary }]}>{hours}h {mins}m</Text>
          <Text style={[styles.hwStatLabel, { color: colors.mutedForeground }]}>Uptime</Text>
        </View>
        <View style={[styles.hwStatDivider, { backgroundColor: colors.border }]} />
        <View style={styles.hwStat}>
          <Text style={[styles.hwStatValue, { color: hw.gpuAvailable ? colors.secondary : colors.mutedForeground }]}>
            {hw.gpuAvailable ? 'YES' : 'NO'}
          </Text>
          <Text style={[styles.hwStatLabel, { color: colors.mutedForeground }]}>GPU</Text>
        </View>
        <View style={[styles.hwStatDivider, { backgroundColor: colors.border }]} />
        <View style={styles.hwStat}>
          <Text style={[styles.hwStatValue, { color: colors.primary }]}>
            {hw.recommendedPowerMode.toUpperCase()}
          </Text>
          <Text style={[styles.hwStatLabel, { color: colors.mutedForeground }]}>Rec. Power</Text>
        </View>
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data: hw, isLoading, refetch } = useQuery<HardwareMetrics>({
    queryKey: ['hardware-metrics'],
    queryFn: fetchHardwareMetrics,
    refetchInterval: 5_000,
    staleTime: 4_000,
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
        <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
      }
    >
      <Text style={[styles.screenTitle, { color: colors.foreground }]}>System</Text>

      {hw && <HardwareCard hw={hw} />}

      {/* About */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius + 4 }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>About</Text>
        <View style={[styles.aboutRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.aboutLabel, { color: colors.mutedForeground }]}>App</Text>
          <Text style={[styles.aboutValue, { color: colors.foreground }]}>Babis M1</Text>
        </View>
        <View style={[styles.aboutRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.aboutLabel, { color: colors.mutedForeground }]}>Version</Text>
          <Text style={[styles.aboutValue, { color: colors.foreground }]}>1.0.0</Text>
        </View>
        <View style={[styles.aboutRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.aboutLabel, { color: colors.mutedForeground }]}>Bundle ID</Text>
          <Text style={[styles.aboutValue, { color: colors.foreground }]}>com.worksin.two</Text>
        </View>
        <View style={[styles.aboutRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.aboutLabel, { color: colors.mutedForeground }]}>Team</Text>
          <Text style={[styles.aboutValue, { color: colors.foreground }]}>Jiangsu Simcere Pharma</Text>
        </View>
        <View style={styles.aboutRow}>
          <Text style={[styles.aboutLabel, { color: colors.mutedForeground }]}>Model</Text>
          <Text style={[styles.aboutValue, { color: colors.primary }]}>40M param LLaMA-2</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 16 },
  screenTitle: { fontSize: 28, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  card: { padding: 16, borderWidth: 1 },
  cardTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 14 },
  hardwareRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  hwLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', width: 36 },
  hwValue: { fontSize: 11, fontFamily: 'Inter_500Medium', width: 80, textAlign: 'right' },
  gaugeTrack: { flex: 1, height: 6 },
  gaugeFill: { height: 6 },
  hwStats: { flexDirection: 'row', marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  hwStat: { flex: 1, alignItems: 'center', gap: 4 },
  hwStatValue: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  hwStatLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', letterSpacing: 0.4 },
  hwStatDivider: { width: 1, marginHorizontal: 4 },
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: 1 },
  aboutLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  aboutValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});
