import { AnalyticsProvider } from '@rork-ai/toolkit-sdk';
import { RorkDevWrapper } from '@rork-ai/toolkit-dev-sdk/v54';
// template
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppProvider } from "@/context/AppContext";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="create-trip" options={{ title: "Create Trip", presentation: "modal" }} />
      <Stack.Screen name="join-trip" options={{ title: "Join Trip", presentation: "modal" }} />
      <Stack.Screen name="trip/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="split/[id]" options={{ title: "Split Details" }} />
      <Stack.Screen name="create-split" options={{ title: "Create Split", presentation: "modal" }} />
    </Stack>
  );
}

function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <GestureHandlerRootView>
          <RootLayoutNav />
        </GestureHandlerRootView>
      </AppProvider>
    </QueryClientProvider>
  );
}
export default function RorkRootLayoutWrapper() {
  return (
    <AnalyticsProvider><RorkDevWrapper><RootLayout /></RorkDevWrapper></AnalyticsProvider>
  );
}