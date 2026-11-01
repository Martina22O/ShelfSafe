/**
 * Screen: NotificationPreferencesScreen
 * Configures the store's near-expiry alert window (1 to 60 days) via save_near_expiry_days.
 * Alert on/off toggles are omitted as they have no backend support.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  TouchableOpacity,
  Modal,
  BackHandler,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/types';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { saveNearExpiryDays } from '../../services/storeSettings';

type Props = NativeStackScreenProps<
  ProfileStackParamList,
  'NotificationPreferences'
>;

const QUICK_CHOICES = [3, 7, 14, 30];

export default function NotificationPreferencesScreen({ navigation }: Props) {
  const { near_expiry_days, refresh } = useStoreSettings();

  const [daysInput, setDaysInput] = useState(String(near_expiry_days));
  const [saving, setSaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setDaysInput(String(near_expiry_days));
  }, [near_expiry_days]);

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

  // Validation
  const trimmed = daysInput.trim();
  const isWholeNumber = /^\d+$/.test(trimmed);
  const parsedDays = isWholeNumber ? parseInt(trimmed, 10) : NaN;
  const isValid = !isNaN(parsedDays) && parsedDays >= 1 && parsedDays <= 60;
  const isUnchanged = isValid && parsedDays === near_expiry_days;

  const handleOpenConfirm = () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isValid) {
      setErrorMessage('Near-expiry threshold must be a whole number between 1 and 60 days');
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    setShowConfirmModal(false);
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await saveNearExpiryDays(parsedDays);

      if (res.kind === 'db_error') {
        setErrorMessage(res.message);
        return;
      }

      if (res.kind === 'network_error') {
        setErrorMessage(res.message);
        return;
      }

      await refresh();
      setSuccessMessage('Near-expiry window saved successfully');
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
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>
        Notification Preferences
      </Text>

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

      <View style={{ marginTop: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold' }}>
          Near-expiry window (days)
        </Text>
        <Text style={{ color: 'gray', marginTop: 4 }}>
          Products are marked near expiry when they expire within this many days.
        </Text>

        <TextInput
          style={{
            borderWidth: 1,
            borderColor: '#ccc',
            padding: 8,
            marginTop: 12,
            backgroundColor: '#fff',
            fontSize: 18,
          }}
          value={daysInput}
          onChangeText={(text) => {
            setDaysInput(text);
            setSuccessMessage(null);
            setErrorMessage(null);
          }}
          keyboardType="number-pad"
          editable={!saving}
        />
        <Text style={{ color: 'gray', fontSize: 12, marginTop: 4 }}>
          Enter a whole number from 1 to 60
        </Text>

        {/* Quick-choice buttons */}
        <Text style={{ marginTop: 16, fontWeight: 'bold', color: 'gray' }}>
          Quick choices:
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          {QUICK_CHOICES.map((choice) => {
            const isSelected = parsedDays === choice;
            return (
              <TouchableOpacity
                key={choice}
                onPress={() => {
                  setDaysInput(String(choice));
                  setSuccessMessage(null);
                  setErrorMessage(null);
                }}
                disabled={saving}
                style={{
                  borderWidth: 1,
                  borderColor: isSelected ? '#2e7d32' : '#ccc',
                  backgroundColor: isSelected ? '#e8f5e9' : '#fff',
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                  borderRadius: 4,
                }}
              >
                <Text
                  style={{
                    color: isSelected ? '#2e7d32' : '#333',
                    fontWeight: isSelected ? 'bold' : 'normal',
                  }}
                >
                  {choice} days
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={{ marginTop: 32, gap: 12 }}>
        <Button
          title={saving ? 'Saving preferences...' : 'Save preferences'}
          onPress={handleOpenConfirm}
          disabled={saving || !isValid || isUnchanged}
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
              Save Near-Expiry Window?
            </Text>
            <Text style={{ color: 'gray', marginTop: 8 }}>
              Set near-expiry window to {parsedDays} day{parsedDays === 1 ? '' : 's'}?
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
