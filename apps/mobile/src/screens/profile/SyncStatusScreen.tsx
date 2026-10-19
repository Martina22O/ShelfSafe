/**
 * Screen: SyncStatusScreen
 * Elements:
 * - Screen Name: Sync Status
 * - Connection status ("Connected")
 * - Last synced timestamp
 * - "Sync now" button
 * - "Back" button
 */
import React, { useState } from 'react';
import { View, Text, Button } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'SyncStatus'>;

export default function SyncStatusScreen({ navigation }: Props) {
  const [syncTime, setSyncTime] = useState('Just now');
  const [syncing, setSyncing] = useState(false);

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      setSyncTime(new Date().toLocaleTimeString());
    }, 1000);
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Sync Status</Text>

      <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 16, marginTop: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold' }}>Connection Status</Text>
        <Text style={{ color: 'green', marginTop: 4 }}>• Connected to Supabase</Text>
        <Text style={{ color: 'gray', marginTop: 8 }}>Last synced: {syncTime}</Text>
      </View>

      <View style={{ marginTop: 24, gap: 12 }}>
        <Button
          title={syncing ? 'Syncing...' : 'Sync now'}
          onPress={handleSync}
          disabled={syncing}
        />
        <Button title="Back" onPress={() => navigation.goBack()} color="gray" />
      </View>
    </View>
  );
}
