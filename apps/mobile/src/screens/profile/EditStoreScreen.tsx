/**
 * Screen: EditStoreScreen
 * Updates store details (store name and contact number) via save_store_details.
 * Refreshes StoreSettingsContext after saving.
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
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { saveStoreDetails } from '../../services/storeSettings';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditStore'>;

export default function EditStoreScreen({ navigation }: Props) {
  const { store_name, contact_number, refresh } = useStoreSettings();

  const [storeName, setStoreName] = useState(store_name || '');
  const [contactNumber, setContactNumber] = useState(contact_number || '');

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

    if (storeName.trim().length > 100) {
      setErrorMessage('Store name cannot exceed 100 characters');
      return;
    }
    if (contactNumber.trim().length > 30) {
      setErrorMessage('Contact number cannot exceed 30 characters');
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    setShowConfirmModal(false);
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedStoreName = storeName.trim() || null;
    const trimmedContactNumber = contactNumber.trim() || null;

    try {
      const res = await saveStoreDetails({
        storeName: trimmedStoreName,
        contactNumber: trimmedContactNumber,
      });

      if (res.kind === 'db_error') {
        setErrorMessage(res.message);
        return;
      }

      if (res.kind === 'network_error') {
        setErrorMessage(res.message);
        return;
      }

      await refresh();
      setSuccessMessage('Store details saved successfully');
    } catch (err: any) {
      setErrorMessage(
        'Not sure if this was saved. Pull down to refresh and check'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Edit Store Details</Text>

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

      <Text style={{ marginTop: 16 }}>Store name (optional)</Text>
      <TextInput
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          padding: 8,
          marginTop: 4,
          backgroundColor: '#fff',
        }}
        placeholder="Enter store name"
        value={storeName}
        onChangeText={setStoreName}
        maxLength={100}
        editable={!saving}
      />
      <Text style={{ color: 'gray', fontSize: 12, marginTop: 2 }}>
        At most 100 characters
      </Text>

      <Text style={{ marginTop: 16 }}>Contact number (optional)</Text>
      <TextInput
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          padding: 8,
          marginTop: 4,
          backgroundColor: '#fff',
        }}
        placeholder="Enter contact number"
        value={contactNumber}
        onChangeText={setContactNumber}
        maxLength={30}
        keyboardType="phone-pad"
        editable={!saving}
      />
      <Text style={{ color: 'gray', fontSize: 12, marginTop: 2 }}>
        At most 30 characters
      </Text>

      <View style={{ marginTop: 24, gap: 12 }}>
        <Button
          title={saving ? 'Saving store details...' : 'Save store details'}
          onPress={handleOpenConfirm}
          disabled={saving}
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
              Save Store Details?
            </Text>
            <Text style={{ color: 'gray', marginTop: 8 }}>
              Are you sure you want to update your store details?
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
