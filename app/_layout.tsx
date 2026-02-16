
// template
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppProvider } from "@/context/AppContext";
import { AlertProvider } from '@/context/AlertContext';
import "@/lib/locationTask"; // Register background task
import { registerBackgroundFetchAsync } from "@/lib/backgroundTask";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <AlertProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="create-trip" options={{ presentation: "modal" }} />
        <Stack.Screen name="join-trip" options={{ title: "Join Trip", presentation: "modal" }} />
        <Stack.Screen name="trip/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="split/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="create-split" options={{ presentation: "modal" }} />
        <Stack.Screen name="create-event" options={{ presentation: "modal" }} />
      </Stack>
    </AlertProvider>
  );
}

function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
    registerBackgroundFetchAsync().catch(err => console.error("Failed to register background task:", err));
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
export default function RootLayoutWrapper() {
  return <RootLayout />;
}