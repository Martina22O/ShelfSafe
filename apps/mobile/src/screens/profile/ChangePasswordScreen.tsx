/**
 * Screen: ChangePasswordScreen
 * Verifies current password via signInWithPassword, enforces password constraints,
 * and updates password via updateUser. Never logs or displays passwords.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  Modal,
  BackHandler,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/types';
import { supabase } from '../../services/supabase';
import { isDatabaseError } from '../../services/inventory';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ChangePassword'>;

export default function ChangePasswordScreen({ navigation }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [saving, setSaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Block back navigation while saving
  useEffect(() => {
    const backAction = () => {
      if (saving) return true;
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [saving]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!saving) return;
      e.preventDefault();
    });
    return unsubscribe;
  }, [navigation, saving]);

  const handleOpenConfirm = () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!currentPassword) {
      setErrorMessage('Please enter your current password');
      return;
    }
    if (!newPassword) {
      setErrorMessage('Please enter a new password');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters');
      return;
    }
    if (newPassword === currentPassword) {
      setErrorMessage('New password cannot be the same as your current password');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match');
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmUpdate = async () => {
    setShowConfirmModal(false);
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !user.email) {
        setErrorMessage('User session not found. Please sign in again.');
        return;
      }

      // Step 1: Verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        setErrorMessage('Current password is incorrect');
        return;
      }

      // Step 2: Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        if (isDatabaseError(updateError)) {
          setErrorMessage(updateError.message);
        } else {
          setErrorMessage(
            'Not sure if this was saved. Pull down to refresh and check'
          );
        }
        return;
      }

      // Step 3: Success: clear fields and show success message
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMessage('Password changed successfully');
    } catch (err: any) {
      if (isDatabaseError(err)) {
        setErrorMessage(err?.message || 'Database error occurred');
      } else {
        setErrorMessage(
          'Not sure if this was saved. Pull down to refresh and check'
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Change Password</Text>

      {/* Success banner */}
      {successMessage && (
        <View
          style={{
            marginTop: 12,
            padding: 10,
            borderWidth: 1,
            borderColor: '#2e7d32',
            backgroundColor: '#edf7ed',
          }}
        >
          <Text style={{ color: '#2e7d32', fontWeight: 'bold' }}>
            {successMessage}
          </Text>
        </View>
      )}

      {/* Error banner */}
      {errorMessage && (
        <View
          style={{
            marginTop: 12,
            padding: 10,
            borderWidth: 1,
            borderColor: '#d9534f',
            backgroundColor: '#fdf7f7',
          }}
        >
          <Text style={{ color: '#d9534f', fontWeight: 'bold' }}>
            {errorMessage}
          </Text>
        </View>
      )}

      <Text style={{ marginTop: 16 }}>Current password</Text>
      <TextInput
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          padding: 8,
          marginTop: 4,
          backgroundColor: '#fff',
        }}
        placeholder="Enter current password"
        value={currentPassword}
        onChangeText={setCurrentPassword}
        secureTextEntry
        editable={!saving}
      />

      <Text style={{ marginTop: 16 }}>New password</Text>
      <TextInput
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          padding: 8,
          marginTop: 4,
          backgroundColor: '#fff',
        }}
        placeholder="Enter new password (min. 8 characters)"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        editable={!saving}
      />

      <Text style={{ marginTop: 16 }}>Confirm new password</Text>
      <TextInput
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          padding: 8,
          marginTop: 4,
          backgroundColor: '#fff',
        }}
        placeholder="Confirm new password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        editable={!saving}
      />

      <View style={{ marginTop: 24, gap: 12 }}>
        <Button
          title={saving ? 'Updating password...' : 'Update password'}
          onPress={handleOpenConfirm}
          disabled={saving || !currentPassword || !newPassword || !confirmPassword}
          color="#2e7d32"
        />
        <Button
          title="Back"
          onPress={() => navigation.goBack()}
          color="gray"
          disabled={saving}
        />
      </View>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!saving) setShowConfirmModal(false);
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
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
              Change Password?
            </Text>
            <Text style={{ color: 'gray', marginTop: 8 }}>
              Are you sure you want to update your account password?
            </Text>

            <View
              style={{
                marginTop: 20,
                flexDirection: 'row',
                justifyContent: 'flex-end',
                gap: 12,
              }}
            >
              <Button
                title="Cancel"
                onPress={() => setShowConfirmModal(false)}
                color="gray"
                disabled={saving}
              />
              <Button
                title="Update"
                onPress={handleConfirmUpdate}
                color="#2e7d32"
                disabled={saving}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
