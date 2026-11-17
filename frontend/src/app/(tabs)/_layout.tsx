// The five bottom tabs. Each file in this folder (index, categories, ...) is one tab.
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { Colors } from '@/constants/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(active: IconName, inactive: IconName) {
  return function TabIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    // Our tab colours are always plain strings, so this narrowing is safe.
    return <Ionicons name={focused ? active : inactive} size={size} color={color as string} />;
  };
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: Colors.navy },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: '600' },
        // Navy for the active tab: orange is kept for buttons and badges.
        tabBarActiveTintColor: Colors.navy,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: { backgroundColor: Colors.white, borderTopColor: Colors.border },
        tabBarLabelStyle: { fontSize: 11 },
      }}>
      <Tabs.Screen
        name="index"
        // Home draws its own navy header (wordmark, search, cart and bell).
        options={{ title: 'Home', headerShown: false, tabBarIcon: tabIcon('home', 'home-outline') }}
      />
      <Tabs.Screen
        name="categories"
        options={{ title: 'Categories', tabBarIcon: tabIcon('grid', 'grid-outline') }}
      />
      <Tabs.Screen
        name="wishlist"
        options={{ title: 'Wishlist', tabBarIcon: tabIcon('heart', 'heart-outline') }}
      />
      <Tabs.Screen
        name="orders"
        options={{ title: 'Orders', tabBarIcon: tabIcon('cube', 'cube-outline') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: tabIcon('person', 'person-outline') }}
      />
    </Tabs>
  );
}
