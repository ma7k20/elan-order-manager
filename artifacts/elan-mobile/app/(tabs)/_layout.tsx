import React, { useEffect } from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { Redirect } from 'expo-router';
import { useMobileAuth } from '@/lib/auth';

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
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
      <Tabs.Screen
        name="index"
        options={{
          title: 'الرئيسية',
          tabBarIcon: ({ color }) =>
            <Feather name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen name="orders" options={{ title: 'الطلبات', tabBarIcon: ({ color }) => <Feather name="package" size={21} color={color} /> }} />
      <Tabs.Screen name="customers" options={{ title: 'العملاء', tabBarIcon: ({ color }) => <Feather name="users" size={21} color={color} /> }} />
      <Tabs.Screen name="finance" options={{ title: 'المالية', tabBarIcon: ({ color }) => <Feather name="credit-card" size={21} color={color} /> }} />
      <Tabs.Screen name="more" options={{ title: 'المزيد', tabBarIcon: ({ color }) => <Feather name="grid" size={21} color={color} /> }} />
      <Tabs.Screen name="purchases" options={{ href: null }} />
      <Tabs.Screen name="shipments" options={{ href: null }} />
      <Tabs.Screen name="reports" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}

export default function TabLayout() {
  const { account, loading } = useMobileAuth();
  if (loading) return null;
  if (!account) return <Redirect href="/sign-in" />;
  return <ClassicTabLayout />;
}
