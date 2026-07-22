/**
 * Download screen — Expo Go instant install + enterprise OTA.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
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
import * as Clipboard from 'expo-clipboard';
import { useQuery } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
const CERTS = [
  { id: 'workone' as const, label: 'Certificate 1', subtitle: 'Jiangsu Simcere · Primary' },
  { id: 'worktwo' as const, label: 'Certificate 2', subtitle: 'Jiangsu Simcere · Secondary' },
] as const;
type CertId = (typeof CERTS)[number]['id'];

interface IosStatus { workone: { available: boolean }; worktwo: { available: boolean }; }
interface ExpoUrlData { expoUrl: string; webUrl: string; domain: string; }

function apiBase() {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}/api` : '/api';
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function DownloadScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selectedCert, setSelectedCert] = useState<CertId>('workone');
  const [copied, setCopied] = useState(false);

  const { data: iosStatus, isLoading: iosLoading } = useQuery<IosStatus>({
    queryKey: ['ios-status'],
    queryFn: async () => {
      const r = await fetch(`${apiBase()}/ios/status`);
      if (!r.ok) throw new Error('Failed');
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const { data: expoData, isLoading: expoLoading } = useQuery<ExpoUrlData>({
    queryKey: ['expo-url'],
    queryFn: async () => {
      const r = await fetch(`${apiBase()}/expo-url`);
      if (!r.ok) throw new Error('Failed');
      return r.json();
    },
    staleTime: Infinity,
  });

  const isAvailable = iosStatus?.[selectedCert]?.available ?? false;
  const expoUrl = expoData?.expoUrl;

  const handleOpenExpoGo = async () => {
    if (!expoUrl) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const supported = await Linking.canOpenURL(expoUrl);
    if (supported) {
      await Linking.openURL(expoUrl);
    } else {
      // Expo Go not installed — open the App Store
      await Linking.openURL('https://apps.apple.com/app/expo-go/id982107779');
    }
  };

  const handleCopyUrl = async () => {
    if (!expoUrl) return;
    void Haptics.selectionAsync();
    await Clipboard.setStringAsync(expoUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleIpaInstall = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const manifestUrl = `${apiBase()}/ios/manifest/${selectedCert}.plist`;
    const installUrl = `itms-services://?action=download-manifest&url=${encodeURIComponent(manifestUrl)}`;
    void Linking.openURL(installUrl);
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Download</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: bottomPad + 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* App hero */}
        <View style={styles.hero}>
          <View style={[styles.appIcon, { borderColor: colors.primary + '30' }]}>
            <Image
              source={require('@/assets/images/icon.png')}
              style={styles.iconImage}
              resizeMode="cover"
            />
          </View>
          <Text style={[styles.appName, { color: colors.foreground }]}>Babis M1</Text>
          <Text style={[styles.appTagline, { color: colors.mutedForeground }]}>
            AI Powered · Limitless Possibilities
          </Text>
          <View style={styles.badgeRow}>
            {['v1.0.0', 'iOS'].map((t) => (
              <View key={t} style={[styles.badge, { borderColor: colors.primary + '40', backgroundColor: colors.primary + '15' }]}>
                <Text style={[styles.badgeText, { color: colors.primary }]}>{t}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── EXPO GO — INSTANT INSTALL ─────────────────────────────────── */}
        <View style={[styles.expoCard, { borderColor: colors.primary + '40', backgroundColor: colors.primary + '08' }]}>
          {/* Header row */}
          <View style={[styles.expoCardHeader, { borderBottomColor: colors.primary + '20' }]}>
            <View style={[styles.expoIcon, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '30' }]}>
              <Feather name="zap" size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.expoTitle, { color: colors.foreground }]}>Install via Expo Go</Text>
              <Text style={[styles.expoSub, { color: colors.mutedForeground }]}>
                Free · No Apple account needed · Instant
              </Text>
            </View>
            <View style={[styles.recommendedBadge, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '40' }]}>
              <Text style={[styles.recommendedText, { color: colors.primary }]}>RECOMMENDED</Text>
            </View>
          </View>

          <View style={{ padding: 16, gap: 14 }}>
            {expoLoading ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : expoUrl ? (
              <>
                {/* Status */}
                <View style={[styles.statusBanner, { backgroundColor: colors.secondary + '12', borderColor: colors.secondary + '30' }]}>
                  <Feather name="check-circle" size={14} color={colors.secondary} />
                  <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
                    Tap <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>Open in Expo Go</Text> below.
                    If Expo Go isn't installed yet, you'll be redirected to the App Store.
                  </Text>
                </View>

                {/* Main button */}
                <Pressable
                  style={[styles.mainBtn, { backgroundColor: colors.primary }]}
                  onPress={handleOpenExpoGo}
                >
                  <Feather name="smartphone" size={20} color={colors.primaryForeground} />
                  <Text style={[styles.mainBtnText, { color: colors.primaryForeground }]}>
                    Open in Expo Go
                  </Text>
                </Pressable>

                {/* Copy URL */}
                <Pressable
                  style={[styles.copyRow, { borderColor: colors.border, backgroundColor: colors.muted }]}
                  onPress={handleCopyUrl}
                >
                  <Text style={[styles.copyUrl, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {expoUrl}
                  </Text>
                  <View style={[styles.copyBtn, { backgroundColor: copied ? colors.secondary + '20' : colors.card, borderColor: colors.border }]}>
                    <Feather name={copied ? 'check' : 'copy'} size={12} color={copied ? colors.secondary : colors.primary} />
                    <Text style={[styles.copyBtnText, { color: copied ? colors.secondary : colors.primary }]}>
                      {copied ? 'Copied' : 'Copy'}
                    </Text>
                  </View>
                </Pressable>

                {/* Steps */}
                <View style={{ gap: 6 }}>
                  <Text style={[styles.stepsLabel, { color: colors.mutedForeground }]}>Steps</Text>
                  {[
                    'Tap "Open in Expo Go" above.',
                    'Expo Go opens and loads Babis AI instantly.',
                    'No installation prompt — the app runs immediately.',
                  ].map((text, i) => (
                    <View key={i} style={[styles.step, { borderColor: colors.border, backgroundColor: colors.card }]}>
                      <View style={[styles.stepNum, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '30' }]}>
                        <Text style={[styles.stepNumText, { color: colors.primary }]}>{i + 1}</Text>
                      </View>
                      <Text style={[styles.stepText, { color: colors.mutedForeground }]}>{text}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <View style={[styles.statusBanner, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Feather name="alert-circle" size={14} color={colors.mutedForeground} />
                <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
                  Expo URL not available. Make sure the app is running.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── ENTERPRISE IPA ─────────────────────────────────────────────── */}
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <View style={[styles.ipaHeader, { borderBottomColor: colors.border }]}>
            <Feather name="package" size={14} color={colors.mutedForeground} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.ipaTitle, { color: colors.foreground }]}>Enterprise IPA</Text>
              <Text style={[styles.ipaSub, { color: colors.mutedForeground }]}>
                Jiangsu Simcere certificates
              </Text>
            </View>
          </View>

          <View style={{ padding: 14, gap: 12 }}>
            {/* Cert selector */}
            <View style={styles.certRow}>
              {CERTS.map((cert) => {
                const available = iosStatus?.[cert.id]?.available ?? false;
                const active = selectedCert === cert.id;
                return (
                  <Pressable
                    key={cert.id}
                    onPress={() => { void Haptics.selectionAsync(); setSelectedCert(cert.id); }}
                    style={[
                      styles.certCard,
                      {
                        borderColor: active ? colors.primary + '60' : colors.border,
                        backgroundColor: active ? colors.primary + '10' : colors.muted,
                      },
                    ]}
                  >
                    <View style={styles.certTop}>
                      <Text style={[styles.certLabel, { color: colors.foreground }]}>{cert.label}</Text>
                      <View style={[styles.certDot, {
                        backgroundColor: iosLoading ? colors.mutedForeground + '40'
                          : available ? colors.secondary
                          : colors.mutedForeground + '40',
                      }]} />
                    </View>
                    <Text style={[styles.certSub, { color: colors.mutedForeground }]}>{cert.subtitle}</Text>
                    <Text style={[styles.certStatus, { color: available ? colors.secondary : colors.mutedForeground + '80' }]}>
                      {available ? '● READY' : '○ PENDING'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Status */}
            {isAvailable ? (
              <View style={[styles.statusBanner, { backgroundColor: colors.secondary + '12', borderColor: colors.secondary + '30' }]}>
                <Feather name="check-circle" size={14} color={colors.secondary} />
                <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
                  Ready. Open this in Safari on your iPhone then tap Install.
                </Text>
              </View>
            ) : (
              <View style={[styles.statusBanner, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Feather name="alert-circle" size={14} color={colors.mutedForeground} />
                <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
                  Place <Text style={{ color: colors.primary }}>{selectedCert}.ipa</Text> in{' '}
                  <Text style={{ color: colors.primary }}>artifacts/api-server/ios/builds/</Text> to activate.
                </Text>
              </View>
            )}

            <Pressable
              style={[styles.ipaBtn, { backgroundColor: isAvailable ? colors.primary : colors.muted, borderColor: isAvailable ? colors.primary : colors.border, opacity: isAvailable ? 1 : 0.5 }]}
              onPress={handleIpaInstall}
              disabled={!isAvailable}
            >
              <Feather name="download-cloud" size={18} color={isAvailable ? colors.primaryForeground : colors.mutedForeground} />
              <Text style={[styles.ipaBtnText, { color: isAvailable ? colors.primaryForeground : colors.mutedForeground }]}>
                Install via Enterprise
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Enterprise notice */}
        <View style={[styles.notice, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Feather name="shield" size={14} color={colors.primary + '80'} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.noticeTitle, { color: colors.foreground }]}>Enterprise Distribution</Text>
            <Text style={[styles.noticeText, { color: colors.mutedForeground }]}>
              Intended for authorized users of Jiangsu Simcere Pharmaceutical Co., Ltd.
              The Expo Go method is available for internal testing.
            </Text>
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
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  hero: { alignItems: 'center', gap: 8, paddingVertical: 4 },
  appIcon: { width: 80, height: 80, borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  iconImage: { width: '100%', height: '100%' },
  appName: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  appTagline: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  badgeRow: { flexDirection: 'row', gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  // Expo Go card
  expoCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  expoCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  expoIcon: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  expoTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  expoSub: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  recommendedBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  recommendedText: { fontSize: 8, fontFamily: 'Inter_700Bold', letterSpacing: 0.8 },
  statusBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: 10, borderRadius: 8, borderWidth: 1,
  },
  statusText: { flex: 1, fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  mainBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 14, borderRadius: 12,
  },
  mainBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  copyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8,
  },
  copyUrl: { flex: 1, fontSize: 10, fontFamily: 'Inter_400Regular' },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1,
  },
  copyBtnText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  stepsLabel: { fontSize: 9, fontFamily: 'Inter_600SemiBold', letterSpacing: 1, textTransform: 'uppercase' },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 9, borderRadius: 7, borderWidth: 1 },
  stepNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  stepNumText: { fontSize: 9, fontFamily: 'Inter_700Bold' },
  stepText: { flex: 1, fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 17, paddingTop: 2 },
  // Enterprise IPA card
  card: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  ipaHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1 },
  ipaTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  ipaSub: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  certRow: { flexDirection: 'row', gap: 8 },
  certCard: { flex: 1, borderRadius: 8, borderWidth: 1, padding: 10, gap: 3 },
  certTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  certLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  certDot: { width: 7, height: 7, borderRadius: 3.5 },
  certSub: { fontSize: 9, fontFamily: 'Inter_400Regular' },
  certStatus: { fontSize: 8, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.6 },
  ipaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: 10, borderWidth: 1,
  },
  ipaBtnText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  // Notice
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1 },
  noticeTitle: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  noticeText: { fontSize: 10, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  center: { paddingVertical: 24, alignItems: 'center' },
});
