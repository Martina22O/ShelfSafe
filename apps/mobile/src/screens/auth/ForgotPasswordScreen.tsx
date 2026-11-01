/**
 * Screen: ForgotPasswordScreen
 * Placeholder screen for password reset.
 * Does not call resetPasswordForEmail as email dispatch is not configured.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleReset = () => {
    setStatusMessage('Password reset by email is not available yet.');
  };

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Reset password</Text>
      <Text style={{ fontSize: 16, marginTop: 4, color: 'gray' }}>
        Password reset by email is not available yet.
      </Text>

      {statusMessage ? (
        <Text style={{ color: '#d9534f', marginTop: 12, fontWeight: 'bold' }}>
          {statusMessage}
        </Text>
      ) : null}

      <Text style={{ marginTop: 16 }}>Email</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4 }}
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <View style={{ marginTop: 24 }}>
        <Button title="Send reset link" onPress={handleReset} />
      </View>

      <View style={{ marginTop: 16, alignItems: 'center' }}>
        <Button
          title="Back to Sign in"
          onPress={() => navigation.navigate('SignIn')}
        />
      </View>
    </View>
  );
}
