/**
 * Screen: EditProfileScreen
 * Elements:
 * - Screen Name: Edit Profile
 * - Full Name input (placeholder: "Your name")
 * - Email address input (placeholder: "you@example.com")
 * - "Save changes" button
 * - "Back" button
 */
import React, { useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditProfile'>;

export default function EditProfileScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Edit Profile</Text>

      <Text style={{ marginTop: 16 }}>Full name</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4 }}
        placeholder="Your name"
        value={name}
        onChangeText={setName}
      />

      <Text style={{ marginTop: 16 }}>Email address</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4 }}
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <View style={{ marginTop: 24, gap: 12 }}>
        <Button title="Save changes" onPress={() => navigation.goBack()} />
        <Button title="Back" onPress={() => navigation.goBack()} color="gray" />
      </View>
    </View>
  );
}
