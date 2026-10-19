/**
 * Screen: SignInScreen
 * Reference: docs/design/01-welcome-signin-signup(3).png
 * Elements:
 * - Screen Name: Sign in
 * - Header ("Welcome back to ShelfSafe")
 * - Email field ("Enter your email", placeholder: "you@example.com")
 * - Password field ("Enter your password")
 * - "Forgot password?" link
 * - "Login" button (calls supabase.auth.signInWithPassword)
 * - "New here? Create an account" link
 * - Error message display
 * - Loading indicator during submit
 */
import React, { useState } from 'react';
import { View, Text, TextInput, Button, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { supabase } from '../../services/supabase';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export default function SignInScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    setErrorMessage(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      setErrorMessage(error.message);
    }
  };

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Sign in</Text>
      <Text style={{ fontSize: 16, marginTop: 4, color: 'gray' }}>
        Welcome back to ShelfSafe
      </Text>

      {errorMessage ? (
        <Text style={{ color: 'red', marginTop: 12 }}>{errorMessage}</Text>
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

      <Text style={{ marginTop: 16 }}>Password</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4 }}
        placeholder="Enter your password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <View style={{ marginTop: 8, alignItems: 'flex-end' }}>
        <Button
          title="Forgot password?"
          onPress={() => navigation.navigate('ForgotPassword')}
        />
      </View>

      <View style={{ marginTop: 24 }}>
        {loading ? (
          <ActivityIndicator />
        ) : (
          <Button title="Login" onPress={handleLogin} />
        )}
      </View>

      <View style={{ marginTop: 16, alignItems: 'center' }}>
        <Button
          title="New here? Create an account"
          onPress={() => navigation.navigate('CreateAccount')}
        />
      </View>
    </View>
  );
}
