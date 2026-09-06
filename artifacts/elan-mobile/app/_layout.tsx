import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { Alert } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { setBaseUrl } from '@workspace/api-client-react';
import { MobileAuthProvider } from '@/lib/auth';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();
const domain = process.env.EXPO_PUBLIC_DOMAIN;
if (domain) setBaseUrl(`https://${domain}`);

type MobileUpdateInfo = { version: string; url: string; message: string; required: boolean };

function isNewerVersion(remote: string, current: string) {
  const parse = (value: string) => value.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const next = parse(remote);
  const installed = parse(current);
  return next.some((part, index) => part > (installed[index] || 0)) || next.length > installed.length;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    const apiDomain = process.env.EXPO_PUBLIC_DOMAIN;
    if (!apiDomain) return;
    const currentVersion = Constants.expoConfig?.version || '0.0.0';
    fetch(`https://${apiDomain}/api/mobile/update-info`)
      .then((response) => response.ok ? response.json() as Promise<MobileUpdateInfo> : null)
      .then((update) => {
        if (!update?.version || !update.url || !isNewerVersion(update.version, currentVersion)) return;
        Alert.alert('تحديث جديد متوفر', update.message, [
          ...(update.required ? [] : [{ text: 'لاحقًا', style: 'cancel' as const }]),
          { text: 'تنزيل التحديث', onPress: () => { void Linking.openURL(update.url); } },
        ], { cancelable: !update.required });
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <MobileAuthProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </MobileAuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
