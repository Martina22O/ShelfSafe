/**
 * Screen: WelcomeScreen (Mobile Landing Page)
 * Background: apps/mobile/assets/designs/landing-background.jpg
 * Reference: docs/design/references/mobile-landing-reference.png
 * Elements:
 * - Full-bleed landing background image containing ShelfSafe branding & illustrations
 * - Functional "Sign In" primary button
 * - Functional "Create Account" secondary button
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { COLORS, FONTS } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      {/* Full-bleed landing artwork */}
      <Image
        source={require('../../../assets/designs/landing-background.jpg')}
        style={styles.bgImage}
        resizeMode="cover"
      />

      {/* Bottom functional buttons positioned in the lower cream section */}
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('SignIn')}
            accessibilityRole="button"
            accessibilityLabel="Sign In"
          >
            <Text style={styles.primaryButtonText}>Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('CreateAccount')}
            accessibilityRole="button"
            accessibilityLabel="Create Account"
          >
            <Text style={styles.secondaryButtonText}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.canvas,
  },
  bgImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 28,
    paddingBottom: 6,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
    gap: 12,
    marginBottom: 4,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    letterSpacing: -0.2,
  },
  secondaryButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: '#ece3d2',
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    letterSpacing: -0.2,
  },
});
