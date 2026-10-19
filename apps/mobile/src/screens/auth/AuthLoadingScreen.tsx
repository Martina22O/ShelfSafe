/**
 * Screen: AuthLoadingScreen
 * Elements:
 * - Screen Title: Loading
 * - Activity Indicator (checking Supabase session)
 * - Status text
 */
import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';

export default function AuthLoadingScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Loading ShelfSafe</Text>
      <ActivityIndicator size="large" />
      <Text>Checking session...</Text>
    </View>
  );
}
