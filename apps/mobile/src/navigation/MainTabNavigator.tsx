/**
 * Tab Navigator: MainTabNavigator
 * Contains 5 Bottom Tabs:
 * 1. HomeTab: DashboardScreen
 * 2. InventoryTab: InventoryNavigator
 * 3. ScanTab: ScanNavigator (Center Tab)
 * 4. AlertsTab: NotificationsScreen
 * 5. ProfileTab: ProfileNavigator
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from './types';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import InventoryNavigator from './InventoryNavigator';
import ScanNavigator from './ScanNavigator';
import NotificationsScreen from '../screens/alerts/NotificationsScreen';
import ProfileNavigator from './ProfileNavigator';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={DashboardScreen}
        options={{ title: 'Home' }}
      />
      <Tab.Screen
        name="InventoryTab"
        component={InventoryNavigator}
        options={{ title: 'Inventory' }}
      />
      <Tab.Screen
        name="ScanTab"
        component={ScanNavigator}
        options={{ title: 'Scan' }}
      />
      <Tab.Screen
        name="AlertsTab"
        component={NotificationsScreen}
        options={{ title: 'Alerts' }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileNavigator}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
}
