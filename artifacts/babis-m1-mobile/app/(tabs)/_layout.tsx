import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';

function TabIcon({ sf, feather, color }: { sf: string; feather: any; color: string }) {
  if (Platform.OS === 'ios') {
    return <SymbolView name={sf as any} tintColor={color} size={22} />;
  }
  return <Feather name={feather} size={22} color={color} />;
}

export default function TabLayout() {
  const colors = useColors();
  const isIOS = Platform.OS === 'ios';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color }) => (
            <TabIcon sf="message" feather="message-circle" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Training',
          tabBarIcon: ({ color }) => (
            <TabIcon sf="chart.xyaxis.line" feather="activity" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="model"
        options={{
          title: 'Model',
          tabBarIcon: ({ color }) => (
            <TabIcon sf="cpu" feather="cpu" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'System',
          tabBarIcon: ({ color }) => (
            <TabIcon sf="server.rack" feather="server" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
