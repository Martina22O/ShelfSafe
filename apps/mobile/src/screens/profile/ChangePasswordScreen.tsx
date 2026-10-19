/**
 * Screen: ChangePasswordScreen
 * Elements:
 * - Screen Name: Change Password
 * - Current password input
 * - New password input
 * - Confirm new password input
 * - "Update password" button
 * - "Back" button
 */
import React, { useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ChangePassword'>;

export default function ChangePasswordScreen({ navigation }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Change Password</Text>

      <Text style={{ marginTop: 16 }}>Current password</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4 }}
        placeholder="Enter current password"
        value={currentPassword}
        onChangeText={setCurrentPassword}
        secureTextEntry
      />

      <Text style={{ marginTop: 16 }}>New password</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4 }}
        placeholder="Enter new password (min. 8 characters)"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
      />

      <Text style={{ marginTop: 16 }}>Confirm new password</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4 }}
        placeholder="Confirm new password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />

      <View style={{ marginTop: 24, gap: 12 }}>
        <Button title="Update password" onPress={() => navigation.goBack()} />
        <Button title="Back" onPress={() => navigation.goBack()} color="gray" />
      </View>
    </View>
  );
}
