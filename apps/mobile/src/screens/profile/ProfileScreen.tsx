/**
 * Screen: ProfileScreen
 * Displays user identity from auth metadata, store details from StoreSettingsContext,
 * and navigation links to profile/store actions.
 * Provides confirmed sign-out clearing cart and store settings.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, Button, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { ProfileStackParamList } from '../../navigation/types';
import { supabase } from '../../services/supabase';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { useSaleCart } from '../../context/SaleCartContext';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Profile'>;

export default function ProfileScreen({ navigation }: Props) {
  const { store_name, contact_number, clearStoreSettings } = useStoreSettings();
  const { clearCart } = useSaleCart();

  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const loadUserData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserName(user.user_metadata?.name || '');
      setUserEmail(user.email || '');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [loadUserData])
  );

  const handleConfirmSignOut = async () => {
    setSigningOut(true);
    try {
      clearCart();
      clearStoreSettings();
      await supabase.auth.signOut();
    } finally {
      setShowSignOutConfirm(false);
      setSigningOut(false);
    }
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
          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
            {userName || 'No name set'}
          </Text>
          <Text style={{ color: 'gray', marginTop: 2 }}>{userEmail}</Text>
        </View>
        <View style={{ marginTop: 12 }}>
          <Button
            title="Edit Profile"
            onPress={() => navigation.navigate('EditProfile')}
            disabled={signingOut}
          />
        </View>
      </View>

      {/* Store Details Card */}
      <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 16, marginTop: 16 }}>
        <Text style={{ fontWeight: 'bold', color: 'gray' }}>Store details</Text>
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
            {store_name || 'Not set yet'}
          </Text>
          <Text style={{ color: 'gray', marginTop: 2 }}>
            Contact: {contact_number || 'Not set yet'}
          </Text>
        </View>
        <View style={{ marginTop: 12 }}>
          <Button
            title="Edit Store"
            onPress={() => navigation.navigate('EditStore')}
            disabled={signingOut}
          />
        </View>
      </View>

      {/* Account & Settings Card */}
      <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 16, marginTop: 16 }}>
        <Text style={{ fontWeight: 'bold', color: 'gray' }}>Account & Settings</Text>

        <View style={{ marginTop: 12 }}>
          <Button
            title="Change Password"
            onPress={() => navigation.navigate('ChangePassword')}
            disabled={signingOut}
          />
        </View>

        <View style={{ marginTop: 12 }}>
          <Button
            title="Notification Preferences"
            onPress={() => navigation.navigate('NotificationPreferences')}
            disabled={signingOut}
          />
        </View>

        <View style={{ marginTop: 12 }}>
          <Button
            title="Sync Status"
            onPress={() => navigation.navigate('SyncStatus')}
            disabled={signingOut}
          />
        </View>
      </View>

      {/* Sign Out Action */}
      <View style={{ marginTop: 24, marginBottom: 40 }}>
        <Button
          title={signingOut ? 'Signing out...' : 'Sign out'}
          onPress={() => setShowSignOutConfirm(true)}
          color="red"
          disabled={signingOut}
        />
      </View>

      {/* Sign Out Confirmation Modal */}
      <Modal
        visible={showSignOutConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!signingOut) setShowSignOutConfirm(false);
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: '#fff',
              padding: 24,
              borderRadius: 8,
              width: '100%',
              maxWidth: 340,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Sign out?</Text>
            <Text style={{ color: 'gray', marginTop: 8 }}>
              Are you sure you want to sign out? Your current cart and local session will be cleared.
            </Text>

            {signingOut ? (
              <View style={{ marginTop: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#d9534f" />
                <Text style={{ marginTop: 8, color: 'gray' }}>Signing out...</Text>
              </View>
            ) : (
              <View style={{ marginTop: 20, flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
                <Button
                  title="Cancel"
                  onPress={() => setShowSignOutConfirm(false)}
                  color="gray"
                  disabled={signingOut}
                />
                <Button
                  title="Sign out"
                  onPress={handleConfirmSignOut}
                  color="#d9534f"
                  disabled={signingOut}
                />
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
