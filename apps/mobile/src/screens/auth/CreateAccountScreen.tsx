/**
 * Screen: CreateAccountScreen
 * Reference: docs/design/01-welcome-signin-signup(2).png
 * Elements:
 * - Screen Name: Create your account
 * - Subtitle ("Start keeping your shelves in check.")
 * - Your name field (placeholder: "Your name")
 * - Email field (placeholder: "you@example.com")
 * - Password field ("At least 8 characters")
 * - "Create account" button (calls supabase.auth.signUp with name saved in user_metadata)
 * - "Check your email" message if no session is returned upon signup
 * - "Already have an account? Sign in" link
 * - Error message display
 * - Loading indicator during submit
 */
import React, { useState } from 'react';
import { View, Text, TextInput, Button, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { supabase } from '../../services/supabase';

type Props = NativeStackScreenProps<AuthStackParamList, 'CreateAccount'>;

export default function CreateAccountScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleSignUp = async () => {
    setErrorMessage(null);
    setInfoMessage(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name.trim() || 'Your name',
        },
      },
    });

    setLoading(false);
    if (error) {
      setErrorMessage(error.message);
    } else if (!data.session) {
      setInfoMessage(
        'Check your email to confirm your account before signing in.'
      );
    }
  };

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>
        Create your account
      </Text>
      <Text style={{ fontSize: 16, marginTop: 4, color: 'gray' }}>
        Start keeping your shelves in check.
      </Text>

      {errorMessage ? (
        <Text style={{ color: 'red', marginTop: 12 }}>{errorMessage}</Text>
      ) : null}

      {infoMessage ? (
        <Text style={{ color: 'green', marginTop: 12 }}>{infoMessage}</Text>
      ) : null}

      <Text style={{ marginTop: 16 }}>Your name</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4 }}
        placeholder="Your name"
        value={name}
        onChangeText={setName}
      />

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
        placeholder="At least 8 characters"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <View style={{ marginTop: 24 }}>
        {loading ? (
          <ActivityIndicator />
        ) : (
          <Button title="Create account" onPress={handleSignUp} />
        )}
      </View>

      <View style={{ marginTop: 16, alignItems: 'center' }}>
        <Button
          title="Already have an account? Sign in"
          onPress={() => navigation.navigate('SignIn')}
        />
      </View>
    </View>
  );
}
