/**
 * Screen: CreateAccountScreen
 * Background: apps/mobile/assets/designs/signup-background.jpg
 * Reference: docs/design/references/mobile-signup-reference.png
 * Elements:
 * - Full-height background with logo & yellow wave
 * - Accessible back button to landing
 * - "Create Your Account" heading & "Start keeping your shelves in check." subtitle
 * - Full Name, Email, and Password fields with visibility toggle
 * - Password requirement helper text
 * - Large green "Create Account" button
 * - "Already have an account? Sign In" link
 * - Keyboard-aware scrolling & Supabase registration
 */
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Image,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Eye, EyeOff, ArrowLeft, CheckCircle2 } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { supabase } from '../../services/supabase';
import { COLORS, FONTS } from '../../theme';
import KeyboardAwareScreen from '../../components/KeyboardAwareScreen';

type Props = NativeStackScreenProps<AuthStackParamList, 'CreateAccount'>;

export default function CreateAccountScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const bgScale = screenWidth / 402;
  const panelHeight = Math.round(874 * bgScale);
  const upperArtworkHeight = Math.round(231 * bgScale);

  // Position form content below the wave while keeping heading near vertical middle (~42%)
  const waveClearance = Math.round(335 * bgScale);
  const formTopPadding = Math.max(
    waveClearance,
    Math.min(
      Math.round(screenHeight * 0.42),
      screenHeight - 435 - insets.bottom - 24
    )
  );

  const scrollRef = useRef<any>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleSignUp = async () => {
    if (!name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }

    setErrorMessage(null);
    setInfoMessage(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          name: name.trim(),
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
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Stationary upper artwork: logo & leaves only, clipped strictly above the wave */}
      <View
        style={[
          styles.upperArtworkContainer,
          {
            width: screenWidth,
            height: upperArtworkHeight,
          },
        ]}
        pointerEvents="none"
      >
        <Image
          source={require('../../../assets/designs/signup-background.jpg')}
          style={{
            width: screenWidth,
            height: panelHeight,
          }}
          resizeMode="contain"
        />
      </View>

      {/* Top back button */}
      <TouchableOpacity
        style={[styles.backButton, { top: insets.top + 8 }]}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <ArrowLeft size={22} color={COLORS.text} strokeWidth={2.2} />
      </TouchableOpacity>

      <KeyboardAwareScreen
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        bottomOffset={32}
      >
        <View style={[styles.movingLayer, { minHeight: screenHeight }]}>
          {/* Proportional edge-to-edge moving panel artwork */}
          <Image
            source={require('../../../assets/designs/signup-form-panel.png')}
            style={[
              styles.panelImage,
              {
                width: screenWidth,
                height: panelHeight,
              },
            ]}
            resizeMode="contain"
            pointerEvents="none"
          />

          {/* Seamless matching cream extension for taller devices and keyboard scroll padding */}
          <View
            style={[
              styles.creamFill,
              {
                top: panelHeight - 1,
                height: Math.max(0, screenHeight - panelHeight) + 600,
              },
            ]}
            pointerEvents="none"
          />

          {/* Form content aligned below the wave */}
          <View
            style={[
              styles.formContent,
              {
                paddingTop: formTopPadding,
                paddingBottom: Math.max(insets.bottom, 16) + 24,
              },
            ]}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Create Your Account</Text>
              <Text style={styles.subtitle}>Start keeping your shelves in check.</Text>
            </View>

            {/* Error Banner */}
            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Success / Info Banner */}
            {infoMessage ? (
              <View style={styles.infoBox}>
                <CheckCircle2 size={18} color={COLORS.primary} strokeWidth={2} />
                <Text style={styles.infoText}>{infoMessage}</Text>
              </View>
            ) : null}

            {/* Form Fields */}
            <View style={styles.formContainer}>
              {/* Full Name Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Juan Dela Cruz"
                  placeholderTextColor={COLORS.textSubtle}
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  autoCapitalize="words"
                  editable={!loading}
                />
              </View>

              {/* Email Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={COLORS.textSubtle}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  editable={!loading}
                />
              </View>

              {/* Password Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="At least 8 characters"
                    placeholderTextColor={COLORS.textSubtle}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    secureTextEntry={!showPassword}
                    editable={!loading}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                    activeOpacity={0.7}
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    accessibilityRole="button"
                  >
                    {showPassword ? (
                      <EyeOff size={20} color={COLORS.textMuted} strokeWidth={2} />
                    ) : (
                      <Eye size={20} color={COLORS.textMuted} strokeWidth={2} />
                    )}
                  </TouchableOpacity>
                </View>
                <Text style={styles.helperText}>Must be at least 8 characters</Text>
              </View>

              {/* Create Account Primary Button */}
              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                activeOpacity={0.85}
                onPress={handleSignUp}
                disabled={loading}
                accessibilityRole="button"
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Create Account</Text>
                )}
              </TouchableOpacity>

              {/* Link to Sign In */}
              <View style={styles.signInRow}>
                <Text style={styles.signInPrompt}>Already have an account? </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('SignIn')}
                  accessibilityRole="button"
                >
                  <Text style={styles.signInLink}>Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAwareScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  upperArtworkContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ece3d2',
  },
  scrollContent: {
    flexGrow: 1,
  },
  movingLayer: {
    width: '100%',
    position: 'relative',
  },
  panelImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  creamFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#fef7e5',
  },
  formContent: {
    paddingHorizontal: 24,
    width: '100%',
  },
  header: {
    marginBottom: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  errorBox: {
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.dangerDark,
    fontSize: 13,
    fontFamily: FONTS.medium,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.bgTint,
    borderWidth: 1,
    borderColor: '#d6f0b4',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    color: COLORS.primary,
    fontSize: 13,
    fontFamily: FONTS.medium,
  },
  formContainer: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 13,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#ece3d2',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#ece3d2',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
  },
  passwordInput: {
    flex: 1,
    height: 48,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  eyeButton: {
    padding: 6,
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
    fontFamily: FONTS.regular,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    letterSpacing: -0.2,
  },
  signInRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 8,
  },
  signInPrompt: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
  },
  signInLink: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
});
