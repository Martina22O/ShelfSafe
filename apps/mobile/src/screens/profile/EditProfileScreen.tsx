/**
 * Screen: EditProfileScreen
 * Updates the user's display name in Supabase auth user_metadata, preserving
 * other metadata. Displays email as read-only.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  ActivityIndicator,
  Modal,
  BackHandler,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/types';
import { supabase } from '../../services/supabase';
import { isDatabaseError } from '../../services/inventory';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditProfile'>;

export default function EditProfileScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loadingUser, setLoadingUser] = useState(true);

  const [saving, setSaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setName(user.user_metadata?.name || '');
        setEmail(user.email || '');
      }
      setLoadingUser(false);
    });
  }, []);

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

    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMessage('Name cannot be empty');
      return;
    }
    if (trimmed.length > 100) {
      setErrorMessage('Name cannot exceed 100 characters');
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    setShowConfirmModal(false);
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedName = name.trim();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const currentMetadata = user?.user_metadata || {};

      const { error } = await supabase.auth.updateUser({
        data: {
          ...currentMetadata,
          name: trimmedName,
        },
      });

      if (error) {
        if (isDatabaseError(error)) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage(
            'Not sure if this was saved. Pull down to refresh and check'
          );
        }
        return;
      }

      // Refresh signed-in user so Dashboard and Profile immediately show the new name
      await supabase.auth.getUser();
      setSuccessMessage('Profile name updated successfully');
      setName(trimmedName);
    } catch (err: any) {
      if (isDatabaseError(err)) {
        setErrorMessage(err?.message || 'Database error updating profile');
      } else {
        setErrorMessage(
          'Not sure if this was saved. Pull down to refresh and check'
        );
      }
    } finally {
      setSaving(false);
    }
  };

  if (loadingUser) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2e7d32" />
        <Text style={{ marginTop: 12, color: 'gray' }}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Edit Profile</Text>

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

      <Text style={{ marginTop: 16 }}>Full name</Text>
      <TextInput
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          padding: 8,
          marginTop: 4,
          backgroundColor: '#fff',
        }}
        placeholder="Enter your name"
        value={name}
        onChangeText={setName}
        maxLength={100}
        editable={!saving}
      />
      <Text style={{ color: 'gray', fontSize: 12, marginTop: 2 }}>
        At most 100 characters
      </Text>

      <Text style={{ marginTop: 16 }}>Email address</Text>
      <View
        style={{
          borderWidth: 1,
          borderColor: '#e0e0e0',
          backgroundColor: '#f5f5f5',
          padding: 8,
          marginTop: 4,
        }}
      >
        <Text style={{ color: '#333' }}>{email}</Text>
      </View>
      <Text style={{ color: 'gray', fontSize: 12, marginTop: 4 }}>
        Email changes are not available yet
      </Text>

      <View style={{ marginTop: 24, gap: 12 }}>
        <Button
          title={saving ? 'Saving changes...' : 'Save changes'}
          onPress={handleOpenConfirm}
          disabled={saving || !name.trim()}
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
              Save Profile Changes?
            </Text>
            <Text style={{ color: 'gray', marginTop: 8 }}>
              Update your name to "{name.trim()}"?
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
                title="Save"
                onPress={handleConfirmSave}
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
