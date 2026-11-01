/**
 * Screen: SyncStatusScreen
 * Simple and honest connection status based on real server checks.
 * Displays last successful load timestamp in Asia/Manila time.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Button, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/types';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { getStoreSettings } from '../../services/storeSettings';
import { formatManilaDateTime } from '../../utils/date';

type Props = NativeStackScreenProps<ProfileStackParamList, 'SyncStatus'>;

type ConnectionState = 'idle' | 'checking' | 'connected' | 'error';

export default function SyncStatusScreen({ navigation }: Props) {
  const { lastLoadedAt, refresh } = useStoreSettings();
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    lastLoadedAt ? 'connected' : 'idle'
  );
  const [checking, setChecking] = useState(false);

  const handleCheckNow = useCallback(async () => {
    setChecking(true);
    setConnectionState('checking');

    const res = await getStoreSettings();

    if (res.kind === 'success') {
      await refresh();
      setConnectionState('connected');
    } else {
      setConnectionState('error');
    }

    setChecking(false);
  }, [refresh]);

  useEffect(() => {
    handleCheckNow();
  }, [handleCheckNow]);

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Sync Status</Text>

      <View
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          padding: 16,
          marginTop: 16,
          backgroundColor: '#fff',
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: 'bold' }}>Server Connection</Text>

        {connectionState === 'checking' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <ActivityIndicator size="small" color="#2e7d32" />
            <Text style={{ marginLeft: 8, color: 'gray' }}>Checking connection...</Text>
          </View>
        )}

        {connectionState === 'connected' && (
          <Text style={{ color: '#2e7d32', marginTop: 8, fontWeight: 'bold' }}>
            • Connected
          </Text>
        )}

        {connectionState === 'error' && (
          <Text style={{ color: '#d9534f', marginTop: 8, fontWeight: 'bold' }}>
            • Cannot reach the server
          </Text>
        )}

        {connectionState === 'idle' && (
          <Text style={{ color: 'gray', marginTop: 8 }}>
            • Ready to check
          </Text>
        )}

        <Text style={{ color: 'gray', marginTop: 12 }}>
          Last successful sync: {lastLoadedAt ? formatManilaDateTime(lastLoadedAt) : 'None'}
        </Text>
      </View>

      <Text style={{ color: '#555', marginTop: 16, lineHeight: 20 }}>
        Pull down to refresh on any screen to see changes from other devices.
      </Text>

      <View style={{ marginTop: 24, gap: 12 }}>
        <Button
          title={checking ? 'Checking...' : 'Check now'}
          onPress={handleCheckNow}
          disabled={checking}
          color="#2e7d32"
        />
        <Button
          title="Back"
          onPress={() => navigation.goBack()}
          color="gray"
          disabled={checking}
        />
      </View>
    </View>
  );
}
