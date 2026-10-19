/**
 * Screen: EditStoreScreen
 * Elements:
 * - Screen Name: Edit Store Details
 * - Store name input (placeholder: "Your store")
 * - Store location input
 * - "Save store details" button
 * - "Back" button
 */
import React, { useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditStore'>;

export default function EditStoreScreen({ navigation }: Props) {
  const [storeName, setStoreName] = useState('Your store');

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Edit Store Details</Text>

      <Text style={{ marginTop: 16 }}>Store name</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4 }}
        placeholder="Your store"
        value={storeName}
        onChangeText={setStoreName}
      />

      <View style={{ marginTop: 24, gap: 12 }}>
        <Button title="Save store details" onPress={() => navigation.goBack()} />
        <Button title="Back" onPress={() => navigation.goBack()} color="gray" />
      </View>
    </View>
  );
}
