import React from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';

/**
 * IMPORTANT: iOS 26 uses NativeTabs for native tabs with liquid glass support.
 * NativeTabs intentionally does NOT use custom design tokens — liquid glass
 * is a system-level appearance provided by iOS and cannot be overridden.
 * Custom brand colors are applied only on the ClassicTabLayout path (older iOS / Android / web).
 */

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: 'message', selected: 'message.fill' }} />
        <Label>Chat</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="training">
        <Icon sf={{ default: 'bolt', selected: 'bolt.fill' }} />
        <Label>Training</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="workers">
        <Icon sf={{ default: 'server.rack', selected: 'server.rack' }} />
        <Label>Workers</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="model">
        <Icon sf={{ default: 'cube', selected: 'cube.fill' }} />
        <Label>Model</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="download">
        <Icon sf={{ default: 'arrow.down.circle', selected: 'arrow.down.circle.fill' }} />
        <Label>Download</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: {
          fontFamily: 'Inter_500Medium',
          fontSize: 10,
          marginTop: 2,
        },
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          height: isWeb ? 84 : 60,
          paddingBottom: isWeb ? 24 : 6,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={80}
              tint={isDark ? 'dark' : 'light'}
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.background + 'cc' }]}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.background },
              ]}
            />
          ) : null,
      }}
    >
      {/* Chat */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="message.fill" tintColor={color} size={22} />
            ) : (
              <Feather name="message-circle" size={21} color={color} />
            ),
        }}
      />

      {/* Training */}
      <Tabs.Screen
        name="training"
        options={{
          title: 'Training',
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="bolt.fill" tintColor={color} size={22} />
            ) : (
              <Feather name="zap" size={21} color={color} />
            ),
        }}
      />

      {/* Workers */}
      <Tabs.Screen
        name="workers"
        options={{
          title: 'Workers',
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="server.rack" tintColor={color} size={22} />
            ) : (
              <Feather name="server" size={21} color={color} />
            ),
        }}
      />

      {/* Model */}
      <Tabs.Screen
        name="model"
        options={{
          title: 'Model',
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="cube.fill" tintColor={color} size={22} />
            ) : (
              <Feather name="cpu" size={21} color={color} />
            ),
        }}
      />

      {/* Download */}
      <Tabs.Screen
        name="download"
        options={{
          title: 'Download',
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="arrow.down.circle.fill" tintColor={color} size={22} />
            ) : (
              <Feather name="download-cloud" size={21} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
