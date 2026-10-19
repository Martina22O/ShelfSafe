/**
 * Stack Navigator: ProfileNavigator
 * Contains:
 * - Profile
 * - EditProfile
 * - EditStore
 * - ChangePassword
 * - NotificationPreferences
 * - SyncStatus
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileStackParamList } from './types';
import ProfileScreen from '../screens/profile/ProfileScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import EditStoreScreen from '../screens/profile/EditStoreScreen';
import ChangePasswordScreen from '../screens/profile/ChangePasswordScreen';
import NotificationPreferencesScreen from '../screens/profile/NotificationPreferencesScreen';
import SyncStatusScreen from '../screens/profile/SyncStatusScreen';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileNavigator() {
  return (
    <Stack.Navigator initialRouteName="Profile">
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: 'Edit Profile' }}
      />
      <Stack.Screen
        name="EditStore"
        component={EditStoreScreen}
        options={{ title: 'Edit Store Details' }}
      />
      <Stack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{ title: 'Change Password' }}
      />
      <Stack.Screen
        name="NotificationPreferences"
        component={NotificationPreferencesScreen}
        options={{ title: 'Notification Preferences' }}
      />
      <Stack.Screen
        name="SyncStatus"
        component={SyncStatusScreen}
        options={{ title: 'Sync Status' }}
      />
    </Stack.Navigator>
  );
}
