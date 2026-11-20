/**
 * Screen: WelcomeScreen (Mobile Landing Page)
 * Background: AuthBackground (mobile-bg.png in contain mode)
 *
 * Requirements:
 * - Full ShelfSafe logo, brand name, and tagline visible in the upper section.
 * - Sign In and Create Account buttons neatly positioned in the lower cream portion.
 * - Respects bottom safe area and device dimensions.
 * - Preserves existing navigation.
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { COLORS, FONTS } from '../../theme';
import AuthBackground from '../../components/AuthBackground';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  // Use physical screen height so button positioning is completely fixed and stationary
  const screenHeight = Dimensions.get('screen').height;

  // Position buttons neatly in the available cream space below the branding and yellow wave
  // Yellow wave ends at ~42% of screen height; placing buttons at ~52% gives ~85px comfortable breathing space
  // and eliminates the excessive void while keeping balanced breathing room above the bottom basket artwork.
  const buttonGroupTop = Math.max(
    Math.round(screenHeight * 0.52),
    insets.top + 330
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Shared decoupled contained background layer */}
      <AuthBackground />

      {/* Foreground UI: Action buttons placed with balanced spacing */}
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <View style={[styles.contentWrapper, { paddingTop: buttonGroupTop }]}>
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
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FCF9EA',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 20,
    zIndex: 1,
  },
  contentWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#2E8B3C',
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2E8B3C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    letterSpacing: -0.2,
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D8DDD5',
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  secondaryButtonText: {
    color: '#164A23',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    letterSpacing: -0.2,
  },
});
