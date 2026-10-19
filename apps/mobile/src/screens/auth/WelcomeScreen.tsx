/**
 * Screen: WelcomeScreen
 * Reference: docs/design/01-welcome-signin-signup(1).png
 * Elements:
 * - Screen Name: Welcome
 * - ShelfSafe Title & Tagline ("Know what's on your shelf and when it expires")
 * - Subtitle ("Count stock. Track expiry. Sell first-expired items first")
 * - "Sign in" button
 * - "Create an account" button
 */
import React from 'react';
import { View, Text, Button } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: Props) {
  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
      <Text style={{ fontSize: 28, fontWeight: 'bold' }}>Welcome</Text>
      <Text style={{ fontSize: 22, marginTop: 12 }}>ShelfSafe</Text>
      <Text style={{ fontSize: 18, marginTop: 8 }}>
        Know what's on your shelf and when it expires
      </Text>
      <Text style={{ fontSize: 14, marginTop: 4, color: 'gray' }}>
        Count stock. Track expiry. Sell first-expired items first
      </Text>

      <View style={{ marginTop: 32, gap: 12 }}>
        <Button title="Sign in" onPress={() => navigation.navigate('SignIn')} />
        <Button
          title="Create an account"
          onPress={() => navigation.navigate('CreateAccount')}
        />
      </View>
    </View>
  );
}
