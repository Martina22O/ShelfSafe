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
import { TouchableOpacity } from 'react-native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft } from 'lucide-react-native';
import { ProfileStackParamList } from './types';
import ProfileScreen from '../screens/profile/ProfileScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import EditStoreScreen from '../screens/profile/EditStoreScreen';
import ChangePasswordScreen from '../screens/profile/ChangePasswordScreen';
import NotificationPreferencesScreen from '../screens/profile/NotificationPreferencesScreen';
import SyncStatusScreen from '../screens/profile/SyncStatusScreen';
import SubscriptionManagementScreen from '../screens/subscription/SubscriptionManagementScreen';
import HelpSupportHubScreen from '../screens/support/HelpSupportHubScreen';
import NewSupportTicketScreen from '../screens/support/NewSupportTicketScreen';
import SupportTicketListScreen from '../screens/support/SupportTicketListScreen';
import SupportTicketDetailScreen from '../screens/support/SupportTicketDetailScreen';
import { COLORS, FONTS } from '../theme';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Profile"
      screenOptions={({ navigation }: { navigation: NativeStackNavigationProp<ProfileStackParamList> }) => ({
        headerTitleAlign: 'center',
        headerTitleStyle: {
          fontFamily: FONTS.bold,
          fontSize: 17,
          color: COLORS.text,
        },
        headerStyle: { backgroundColor: '#FEF7E6' },
        headerShadowVisible: false,
        headerTintColor: COLORS.text,
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Profile'))}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ paddingRight: 12, paddingVertical: 4 }}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <ArrowLeft size={22} color={COLORS.text} strokeWidth={2.2} />
          </TouchableOpacity>
        ),
      })}
    >
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
      <Stack.Screen
        name="Subscription"
        component={SubscriptionManagementScreen}
        options={{
          title: 'Subscription',
        }}
      />
      <Stack.Screen
        name="HelpSupportHub"
        component={HelpSupportHubScreen}
        options={{
          title: 'Help & Support',
        }}
      />
      <Stack.Screen
        name="NewSupportTicket"
        component={NewSupportTicketScreen}
        options={{
          title: 'New Support Request',
        }}
      />
      <Stack.Screen
        name="SupportTicketList"
        component={SupportTicketListScreen}
        options={{
          title: 'My Support Tickets',
        }}
      />
      <Stack.Screen
        name="SupportTicketDetail"
        component={SupportTicketDetailScreen}
        options={{
          title: 'Ticket Details',
        }}
      />
    </Stack.Navigator>
  );
}
