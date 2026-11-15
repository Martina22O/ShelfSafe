/**
 * Screen: AuthLoadingScreen
 * Elements:
 * - Brand logo & loading indicator while checking Supabase session
 */
import React from 'react';
import { View, Text, ActivityIndicator, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { COLORS, FONTS } from '../../theme';

export default function AuthLoadingScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <Image
          source={require('../../../assets/brand-wordmark.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.spinner} />
        <Text style={styles.text}>Initializing ShelfSafe...</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.canvas,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logo: {
    width: 180,
    height: 48,
    marginBottom: 24,
  },
  spinner: {
    marginBottom: 12,
  },
  text: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
  },
});
