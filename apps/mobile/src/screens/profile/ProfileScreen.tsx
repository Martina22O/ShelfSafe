/**
 * Screen: ProfileScreen
 * Reference: docs/design/05-profile.png
 * Elements:
 * - Screen Name: Profile
 * - Subtitle ("Manage your account and store")
 * - Account identity card (dynamic user name & email, "Edit Profile" button)
 * - Store details card (placeholder store name, "Edit store details" button)
 * - Account & Settings list:
 *   - Change password ("Update your password")
 *   - Notification preferences ("Low-stock and expiry alerts")
 *   - Sync Status ("Connected")
 * - "Sign out" button (calls supabase.auth.signOut)
 */
import React, { useState, useEffect } from 'react';
import { View, Text, Button, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/types';
import { supabase } from '../../services/supabase';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Profile'>;

export default function ProfileScreen({ navigation }: Props) {
  const [userName, setUserName] = useState('Your name');
  const [userEmail, setUserEmail] = useState('you@example.com');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        if (user.user_metadata?.name) {
          setUserName(user.user_metadata.name);
        }
        if (user.email) {
          setUserEmail(user.email);
        }
      }
    });
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Profile</Text>
      <Text style={{ color: 'gray', marginTop: 4 }}>
        Manage your account and store
      </Text>

      {/* Account Identity Card */}
      <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 16, marginTop: 16 }}>
        <Text style={{ fontWeight: 'bold', color: 'gray' }}>Account identity</Text>
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{userName}</Text>
          <Text style={{ color: 'gray' }}>{userEmail}</Text>
        </View>
        <View style={{ marginTop: 12 }}>
          <Button
            title="Edit Profile"
            onPress={() => navigation.navigate('EditProfile')}
          />
        </View>
      </View>

      {/* Store Details Card */}
      <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 16, marginTop: 16 }}>
        <Text style={{ fontWeight: 'bold', color: 'gray' }}>Store details</Text>
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Your store</Text>
          <Text style={{ color: 'gray' }}>Store name</Text>
        </View>
        <View style={{ marginTop: 12 }}>
          <Button
            title="Edit store details"
            onPress={() => navigation.navigate('EditStore')}
          />
        </View>
      </View>

      {/* Account & Settings Card */}
      <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 16, marginTop: 16 }}>
        <Text style={{ fontWeight: 'bold', color: 'gray' }}>Account & Settings</Text>

        <View style={{ marginTop: 12 }}>
          <Button
            title="Change password (Update your password)"
            onPress={() => navigation.navigate('ChangePassword')}
          />
        </View>

        <View style={{ marginTop: 12 }}>
          <Button
            title="Notification preferences (Low-stock & expiry alerts)"
            onPress={() => navigation.navigate('NotificationPreferences')}
          />
        </View>

        <View style={{ marginTop: 12 }}>
          <Button
            title="Sync Status (Connected)"
            onPress={() => navigation.navigate('SyncStatus')}
          />
        </View>
      </View>

      {/* Sign Out Action */}
      <View style={{ marginTop: 24, marginBottom: 40 }}>
        <Button title="Sign out" onPress={handleSignOut} color="red" />
      </View>
    </ScrollView>
  );
}
