/**
 * Tab Navigator: MainTabNavigator
 * Reference: docs/design/mobile/02-home/dashboard_mobile.png
 * Features:
 * - Brand Deep Green bottom bar (#254e06)
 * - Raised circular Amber Scan button (#faab06)
 * - Crisp active indicator pills and status colors
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator, BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayoutDashboard, Package, Bell, User, ScanBarcode } from 'lucide-react-native';
import { MainTabParamList } from './types';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import InventoryNavigator from './InventoryNavigator';
import ScanNavigator from './ScanNavigator';
import NotificationsScreen from '../screens/alerts/NotificationsScreen';
import ProfileNavigator from './ProfileNavigator';
import { COLORS, FONTS } from '../theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Custom Tab Bar Icons using lucide-react-native
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const color = focused ? COLORS.white : COLORS.tabBarInactive;

  if (name === 'Home') {
    return <LayoutDashboard size={20} color={color} strokeWidth={2} />;
  }

  if (name === 'Inventory') {
    return <Package size={20} color={color} strokeWidth={2} />;
  }

  if (name === 'Alerts') {
    return <Bell size={20} color={color} strokeWidth={2} />;
  }

  if (name === 'Profile') {
    return <User size={20} color={color} strokeWidth={2} />;
  }

  return null;
}

// Raised Center Scan Button (Matching mobile/02-home/dashboard_mobile.png)
function ScanTabBarButton(props: BottomTabBarButtonProps) {
  return (
    <TouchableOpacity
      {...props}
      style={styles.scanButtonContainer}
      activeOpacity={0.85}
    >
      <View style={styles.scanButtonCircle}>
        <ScanBarcode size={22} color="#181413" strokeWidth={2.2} />
        <Text style={styles.scanButtonLabel}>SCAN</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function MainTabNavigator() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          {
            paddingBottom: bottomPadding,
            height: 54 + bottomPadding,
          },
        ],
        tabBarActiveTintColor: COLORS.white,
        tabBarInactiveTintColor: COLORS.tabBarInactive,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={DashboardScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon name="Home" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="InventoryTab"
        component={InventoryNavigator}
        options={{
          title: 'Inventory',
          tabBarIcon: ({ focused }) => <TabIcon name="Inventory" focused={focused} />,
        }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            if (navigation.isFocused()) {
              navigation.navigate('InventoryTab', { screen: 'InventoryList' });
            }
          },
        })}
      />
      <Tab.Screen
        name="ScanTab"
        component={ScanNavigator}
        options={{
          title: 'Scan',
          tabBarButton: (props) => <ScanTabBarButton {...props} />,
        }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            if (navigation.isFocused()) {
              navigation.navigate('ScanTab', { screen: 'ScanChooser' });
            }
          },
        })}
      />
      <Tab.Screen
        name="AlertsTab"
        component={NotificationsScreen}
        options={{
          title: 'Alerts',
          tabBarIcon: ({ focused }) => <TabIcon name="Alerts" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileNavigator}
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon name="Profile" focused={focused} />,
        }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            if (navigation.isFocused()) {
              navigation.navigate('ProfileTab', { screen: 'Profile' });
            }
          },
        })}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.tabBarBg,
    borderTopWidth: 0,
    paddingTop: 6,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    marginTop: 2,
  },
  scanButtonContainer: {
    top: -16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanButtonCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.amber,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.tabBarBg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  scanButtonLabel: {
    fontSize: 8,
    fontWeight: '900',
    fontFamily: FONTS.black,
    color: '#181413',
    marginTop: 1,
    letterSpacing: 0.5,
  },
});
