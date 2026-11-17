// The outermost layout. Everything in the app sits inside these providers.
import { QueryClientProvider } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { PincodeProvider } from '@/lib/pincode';
import { queryClient } from '@/lib/query-client';

// Keep the splash screen up until we know whether the user is logged in.
SplashScreen.preventAutoHideAsync();

const headerOptions = {
  headerStyle: { backgroundColor: Colors.navy },
  headerTintColor: Colors.white,
  headerTitleStyle: { fontWeight: '600' as const },
  headerBackTitle: 'Back',
};

function RootNavigator() {
  const { status, entryDone } = useAuth();
  const ready = status !== 'loading';

  useEffect(() => {
    if (!ready) return;
    // First launch: show the welcome slides. Everyone else goes straight to the app.
    const timer = setTimeout(() => {
      if (!entryDone) router.replace('/onboarding');
      SplashScreen.hideAsync();
    }, 0);
    return () => clearTimeout(timer);
    // Only decide once, when loading finishes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="otp" options={{ title: 'Verify your email' }} />
      <Stack.Screen name="register" options={{ title: 'Almost done' }} />
      <Stack.Screen name="password-login" options={{ title: 'Log in' }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Reset password' }} />
      <Stack.Screen name="edit-profile" options={{ title: 'Edit profile' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="set-password" options={{ title: 'Password' }} />
      <Stack.Screen name="addresses/index" options={{ title: 'My addresses' }} />
      <Stack.Screen name="addresses/form" options={{ title: 'Address' }} />
      <Stack.Screen name="search" options={{ title: 'Search', headerShown: false }} />
      <Stack.Screen name="search-results" options={{ title: 'Results' }} />
      <Stack.Screen name="cart" options={{ title: 'My cart' }} />
      <Stack.Screen name="checkout" options={{ title: 'Checkout' }} />
      <Stack.Screen name="payment" options={{ title: 'Payment', gestureEnabled: false }} />
      <Stack.Screen name="order-success" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="help" options={{ title: 'Help' }} />
      <Stack.Screen name="page/[slug]" options={{ title: 'Vetri Mart' }} />
      <Stack.Screen name="review/[slug]" options={{ title: 'Rate and review' }} />
      <Stack.Screen name="my-reviews" options={{ title: 'My reviews' }} />
      <Stack.Screen name="order/[id]" options={{ title: 'Order details' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="category/[slug]" options={{ title: 'Category' }} />
      <Stack.Screen name="product/[slug]" options={{ title: 'Product' }} />
      <Stack.Screen name="collection/[slug]" options={{ title: 'Collection' }} />
      <Stack.Screen name="reviews/[slug]" options={{ title: 'Reviews' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PincodeProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </PincodeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
