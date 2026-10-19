/**
 * Screen: NotificationPreferencesScreen
 * Elements:
 * - Screen Name: Notification Preferences
 * - Low-stock alerts toggle/status
 * - Near-expiry alerts toggle/status
 * - Expiry alert horizon setting (default 7 days)
 * - "Save preferences" button
 * - "Back" button
 */
import React, { useState } from 'react';
import { View, Text, TextInput, Button, Switch } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<
  ProfileStackParamList,
  'NotificationPreferences'
>;

export default function NotificationPreferencesScreen({ navigation }: Props) {
  const [lowStockEnabled, setLowStockEnabled] = useState(true);
  const [nearExpiryEnabled, setNearExpiryEnabled] = useState(true);
  const [daysThreshold, setDaysThreshold] = useState('7');

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>
        Notification Preferences
      </Text>

      <View style={{ marginTop: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 16 }}>Low-stock alerts</Text>
        <Switch value={lowStockEnabled} onValueChange={setLowStockEnabled} />
      </View>

      <View style={{ marginTop: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 16 }}>Near-expiry alerts</Text>
        <Switch value={nearExpiryEnabled} onValueChange={setNearExpiryEnabled} />
      </View>

      <View style={{ marginTop: 20 }}>
        <Text style={{ fontSize: 16 }}>Days before expiry to alert:</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 8 }}
          value={daysThreshold}
          onChangeText={setDaysThreshold}
          keyboardType="numeric"
        />
      </View>

      <View style={{ marginTop: 32, gap: 12 }}>
        <Button title="Save preferences" onPress={() => navigation.goBack()} />
        <Button title="Back" onPress={() => navigation.goBack()} color="gray" />
      </View>
    </View>
  );
}
