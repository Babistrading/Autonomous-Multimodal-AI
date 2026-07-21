/**
 * Download screen — iOS OTA enterprise distribution.
 */

import React, { useState } from 'react';
import {
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
import { useQuery } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------
const CERTS = [
  { id: 'workone' as const, label: 'Certificate 1', subtitle: 'Jiangsu Simcere · Primary' },
  { id: 'worktwo' as const, label: 'Certificate 2', subtitle: 'Jiangsu Simcere · Secondary' },
] as const;

type CertId = (typeof CERTS)[number]['id'];

interface IosStatus {
  workone: { available: boolean };
  worktwo: { available: boolean };
}

function apiBase() {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/api`;
  return '/api';
}

function manifestUrl(cert: CertId) {
  return `${apiBase()}/ios/manifest/${cert}.plist`;
}

function installUrl(cert: CertId) {
  return `itms-services://?action=download-manifest&url=${encodeURIComponent(manifestUrl(cert))}`;
}

function isIosPlatform() {
  return Platform.OS === 'ios';
}

// ---------------------------------------------------------------------------
// Apple logo SVG (inline)
// ---------------------------------------------------------------------------
import Svg, { Path } from 'react-native-svg';
function AppleLogo({ size = 20, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"
        fill={color}
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function DownloadScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selectedCert, setSelectedCert] = useState<CertId>('workone');

  const { data: iosStatus, isLoading } = useQuery<IosStatus>({
    queryKey: ['ios-status'],
    queryFn: async () => {
      const res = await fetch(`${apiBase()}/ios/status`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const isAvailable = iosStatus?.[selectedCert]?.available ?? false;
  const onIos = isIosPlatform();

  const handleInstall = () => {
    if (!isAvailable) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void Linking.openURL(installUrl(selectedCert));
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
          <View style={[styles.appIcon, { borderColor: colors.primary + '30', shadowColor: colors.primary }]}>
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
            <View style={[styles.badge, { borderColor: colors.primary + '40', backgroundColor: colors.primary + '15' }]}>
              <Text style={[styles.badgeText, { color: colors.primary }]}>v1.0.0</Text>
            </View>
            <View style={[styles.badge, { borderColor: colors.border, backgroundColor: colors.muted }]}>
              <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>iOS Enterprise</Text>
            </View>
          </View>
        </View>

        {/* Certificate selector */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            Distribution Certificate
          </Text>
          <View style={styles.certRow}>
            {CERTS.map((cert) => {
              const certAvailable = iosStatus?.[cert.id]?.available ?? false;
              const active = selectedCert === cert.id;
              return (
                <Pressable
                  key={cert.id}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setSelectedCert(cert.id);
                  }}
                  style={[
                    styles.certCard,
                    {
                      borderColor: active ? colors.primary + '60' : colors.border,
                      backgroundColor: active ? colors.primary + '10' : colors.card,
                    },
                  ]}
                >
                  <View style={styles.certCardTop}>
                    <Text style={[styles.certLabel, { color: colors.foreground }]}>{cert.label}</Text>
                    <View
                      style={[
                        styles.certDot,
                        {
                          backgroundColor: isLoading
                            ? colors.mutedForeground + '40'
                            : certAvailable
                            ? colors.secondary
                            : colors.mutedForeground + '40',
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.certSub, { color: colors.mutedForeground }]}>{cert.subtitle}</Text>
                  <Text
                    style={[
                      styles.certStatus,
                      { color: certAvailable ? colors.secondary : colors.mutedForeground + '80' },
                    ]}
                  >
                    {certAvailable ? '● READY' : '○ PENDING'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Status + install card */}
        <View style={[styles.installCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
          {/* Status banner */}
          {isAvailable ? (
            <View style={[styles.statusBanner, { backgroundColor: colors.secondary + '12', borderColor: colors.secondary + '30' }]}>
              <Feather name="check-circle" size={16} color={colors.secondary} />
              <View>
                <Text style={[styles.statusTitle, { color: colors.secondary }]}>Ready to install</Text>
                <Text style={[styles.statusSub, { color: colors.mutedForeground }]}>
                  {onIos
                    ? 'Tap Install — iOS will prompt for confirmation.'
                    : 'Open this screen on your iPhone or iPad in Safari.'}
                </Text>
              </View>
            </View>
          ) : (
            <View style={[styles.statusBanner, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="alert-circle" size={16} color={colors.mutedForeground} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusTitle, { color: colors.mutedForeground }]}>Build not yet available</Text>
                <Text style={[styles.statusSub, { color: colors.mutedForeground }]}>
                  Place{' '}
                  <Text style={{ color: colors.primary }}>{selectedCert}.ipa</Text>
                  {' '}in{' '}
                  <Text style={{ color: colors.primary }}>artifacts/api-server/ios/builds/</Text>
                </Text>
              </View>
            </View>
          )}

          {/* Install button */}
          <Pressable
            style={[
              styles.installBtn,
              {
                backgroundColor: isAvailable ? colors.primary : colors.muted,
                borderColor: isAvailable ? colors.primary : colors.border,
                opacity: isAvailable ? 1 : 0.5,
              },
            ]}
            onPress={handleInstall}
            disabled={!isAvailable}
          >
            {onIos ? (
              <AppleLogo size={20} color={isAvailable ? colors.primaryForeground : colors.mutedForeground} />
            ) : (
              <Feather
                name="download-cloud"
                size={20}
                color={isAvailable ? colors.primaryForeground : colors.mutedForeground}
              />
            )}
            <Text
              style={[
                styles.installBtnText,
                { color: isAvailable ? colors.primaryForeground : colors.mutedForeground },
              ]}
            >
              {onIos ? 'Install on this device' : 'Install on iOS'}
            </Text>
          </Pressable>

          {!onIos && (
            <Text style={[styles.safariNote, { color: colors.mutedForeground }]}>
              Must be opened in <Text style={{ fontFamily: 'Inter_600SemiBold' }}>Safari</Text> on iPhone or iPad
            </Text>
          )}

          {/* Requirements */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.reqLabel, { color: colors.mutedForeground }]}>Requirements</Text>
          <View style={styles.reqGrid}>
            {[
              { label: 'Platform', value: 'iOS 16.0+' },
              { label: 'Device', value: 'iPhone / iPad' },
              { label: 'Browser', value: 'Safari' },
              { label: 'Distribution', value: 'Enterprise' },
            ].map(({ label, value }) => (
              <View key={label} style={styles.reqItem}>
                <Text style={[styles.reqItemLabel, { color: colors.mutedForeground }]}>{label}</Text>
                <Text style={[styles.reqItemValue, { color: colors.foreground }]}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Steps */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>How to install</Text>
          {[
            'Open this screen in Safari on your iPhone or iPad.',
            'Select a certificate above and tap "Install on this device".',
            'Tap "Install" when iOS prompts for confirmation.',
            'Go to Settings → General → VPN & Device Management and trust the Jiangsu Simcere certificate.',
            'Return to your home screen and open Babis M1.',
          ].map((text, i) => (
            <View key={i} style={[styles.step, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <View style={[styles.stepNum, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '30' }]}>
                <Text style={[styles.stepNumText, { color: colors.primary }]}>{i + 1}</Text>
              </View>
              <Text style={[styles.stepText, { color: colors.mutedForeground }]}>{text}</Text>
            </View>
          ))}
        </View>

        {/* Enterprise notice */}
        <View style={[styles.notice, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Feather name="shield" size={14} color={colors.primary + '80'} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.noticeTitle, { color: colors.foreground }]}>Enterprise Distribution</Text>
            <Text style={[styles.noticeText, { color: colors.mutedForeground }]}>
              Distributed via Apple Enterprise Developer Program. Intended exclusively for authorized users of Jiangsu Simcere Pharmaceutical Co., Ltd.
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
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  hero: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  appIcon: {
    width: 88,
    height: 88,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  iconImage: { width: '100%', height: '100%' },
  appName: { fontSize: 22, fontFamily: 'Inter_700Bold', marginTop: 4 },
  appTagline: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  badgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  section: { gap: 8 },
  sectionLabel: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  certRow: { flexDirection: 'row', gap: 10 },
  certCard: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 12, gap: 4 },
  certCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  certLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  certDot: { width: 8, height: 8, borderRadius: 4 },
  certSub: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  certStatus: { fontSize: 9, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8 },
  installCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  statusSub: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  installBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  installBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  safariNote: { textAlign: 'center', fontSize: 11, fontFamily: 'Inter_400Regular' },
  divider: { height: 1 },
  reqLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1 },
  reqGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  reqItem: { width: '45%', gap: 2 },
  reqItemLabel: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  reqItemValue: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  stepNumText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  stepText: { fontSize: 12, fontFamily: 'Inter_400Regular', flex: 1, lineHeight: 18, paddingTop: 3 },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  noticeTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  noticeText: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 17 },
});
