/**
 * Screen: SignInScreen
 * Background: apps/mobile/assets/designs/mobile-bg.png (1708x3684 HD)
 * Reference: docs/design/references/mobilenew-signin-reference.jpg
 * Elements:
 * - Full-height HD background with logo & yellow wave
 * - Accessible back button to landing
 * - Floating rounded form card positioned right along the inner curve of the yellow wave
 * - "Sign In" heading & "Welcome back to ShelfSafe!" subtitle with green swoosh
 * - Email field & Password field with visibility toggle
 * - "Forgot Password?" link
 * - Large green pill "Sign In ->" button
 * - "Don't have an account? Sign Up" navigation link with divider lines
 * - Keyboard-aware scrolling & full validation
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
import { Eye, EyeOff, ArrowLeft, ArrowRight, Mail, Lock } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { supabase } from '../../services/supabase';
import { COLORS, FONTS } from '../../theme';
import KeyboardAwareScreen from '../../components/KeyboardAwareScreen';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export default function SignInScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  // mobile-bg.png is 1708x3684 (aspect ratio 1842/854). Scale proportionally to screen width so the background is never stretched or distorted.
  const bgHeight = Math.round(screenWidth * (1842 / 854));
  // Tagline curved swoosh position (30.9% of bgHeight)
  const taglineSwooshTop = Math.round(bgHeight * 0.309);
  const taglineSwooshLeft = Math.round(screenWidth * 0.42);
  const taglineSwooshWidth = Math.round(screenWidth * 0.25);

  // Position the floating form card right inside the inner curve of the yellow wave (~36.2% of background height)
  const cardTopMargin = Math.max(
    Math.round(bgHeight * 0.362),
    insets.top + 210
  );

  const scrollRef = useRef<any>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }
    setErrorMessage(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) {
      if (/invalid login credentials/i.test(error.message)) {
        setErrorMessage('Invalid email or password.');
      } else {
        setErrorMessage(error.message);
      }
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Top back button */}
      {navigation.canGoBack() && (
        <TouchableOpacity
          style={[styles.backButton, { top: insets.top + 8 }]}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={20} color="#144721" strokeWidth={2.2} />
        </TouchableOpacity>
      )}

      <KeyboardAwareScreen
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        bottomOffset={32}
      >
        <View style={[styles.movingLayer, { minHeight: Math.max(screenHeight, bgHeight) }]}>
          {/* Proportional edge-to-edge HD background artwork */}
          <Image
            source={require('../../../assets/designs/mobile-bg.png')}
            style={[
              styles.bgImage,
              {
                width: screenWidth,
                height: bgHeight,
              },
            ]}
            resizeMode="contain"
            pointerEvents="none"
          />

          {/* Subtle green swoosh under "Smarter Stock, Safer Shelves." matching reference */}
          <View
            pointerEvents="none"
            style={[
              styles.taglineSwoosh,
              {
                top: taglineSwooshTop,
                left: taglineSwooshLeft,
                width: taglineSwooshWidth,
              },
            ]}
          />

          {/* Form content positioned inside the floating card below the yellow wave */}
          <View
            style={[
              styles.cardOuterWrapper,
              {
                paddingTop: cardTopMargin,
                paddingBottom: Math.max(insets.bottom, 16) + 28,
              },
            ]}
          >
            <View style={styles.card}>
              <View style={styles.header}>
                <Text style={styles.title}>Sign In</Text>
                <Text style={styles.subtitle}>Welcome back to ShelfSafe!</Text>
                <View style={styles.swoosh} />
              </View>

              {/* Error Banner */}
              {errorMessage ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              {/* Form Fields */}
              <View style={styles.formContainer}>
                {/* Email Field */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Mail size={17} color="#2B8A38" strokeWidth={2.3} />
                    <Text style={styles.label}>Email</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="you@example.com"
                    placeholderTextColor="#8C948B"
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
                  <View style={styles.labelRow}>
                    <Lock size={17} color="#2B8A38" strokeWidth={2.3} />
                    <Text style={styles.label}>Password</Text>
                  </View>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="Enter your password"
                      placeholderTextColor="#8C948B"
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
                        <EyeOff size={20} color="#747B73" strokeWidth={2} />
                      ) : (
                        <Eye size={20} color="#747B73" strokeWidth={2} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Forgot Password */}
                <TouchableOpacity
                  style={styles.forgotPasswordButton}
                  onPress={() => navigation.navigate('ForgotPassword')}
                  accessibilityRole="button"
                >
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>

                {/* Sign In Primary Button */}
                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.buttonDisabled]}
                  activeOpacity={0.85}
                  onPress={handleLogin}
                  disabled={loading}
                  accessibilityRole="button"
                >
                  {loading ? (
                    <ActivityIndicator color={COLORS.white} size="small" />
                  ) : (
                    <View style={styles.buttonContentRow}>
                      <Text style={styles.primaryButtonText}>Sign In</Text>
                      <ArrowRight size={20} color={COLORS.white} strokeWidth={2.4} />
                    </View>
                  )}
                </TouchableOpacity>

                {/* Link to Create Account with subtle horizontal lines */}
                <View style={styles.createAccountRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.createAccountPrompt}>Don&apos;t have an account? </Text>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('CreateAccount')}
                    accessibilityRole="button"
                  >
                    <Text style={styles.createAccountLink}>Sign Up</Text>
                  </TouchableOpacity>
                  <View style={styles.dividerLine} />
                </View>
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
    backgroundColor: '#FBF9F2',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E1E3DC',
  },
  scrollContent: {
    flexGrow: 1,
  },
  movingLayer: {
    width: '100%',
    position: 'relative',
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  taglineSwoosh: {
    position: 'absolute',
    height: 2.5,
    borderRadius: 2,
    backgroundColor: '#288136',
    transform: [{ rotate: '-2.2deg' }],
  },
  cardOuterWrapper: {
    paddingHorizontal: 14,
    width: '100%',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'rgba(250, 249, 244, 0.96)',
    borderRadius: 32,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 26,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#144721',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 4,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 31,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: '#144721',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: FONTS.medium,
    color: '#3F453E',
    marginTop: 4,
  },
  swoosh: {
    marginTop: 6,
    width: 84,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#2E8B3C',
    transform: [{ rotate: '-2deg' }],
  },
  errorBox: {
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.dangerDark,
    fontSize: 13,
    fontFamily: FONTS.medium,
  },
  formContainer: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingLeft: 2,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: '#1B5728',
  },
  input: {
    backgroundColor: '#FBFBF9',
    borderWidth: 1,
    borderColor: '#D8DDD5',
    borderRadius: 999,
    height: 50,
    paddingHorizontal: 18,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FBFBF9',
    borderWidth: 1,
    borderColor: '#D8DDD5',
    borderRadius: 999,
    height: 50,
    paddingLeft: 18,
    paddingRight: 10,
  },
  passwordInput: {
    flex: 1,
    height: 50,
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
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: -4,
    marginBottom: 18,
    paddingVertical: 4,
    paddingRight: 2,
  },
  forgotPasswordText: {
    color: '#2B8A38',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FONTS.semiBold,
  },
  primaryButton: {
    backgroundColor: '#2E8B3C',
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2E8B3C',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.26,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    letterSpacing: -0.2,
  },
  createAccountRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
    paddingVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E1E3DC',
    marginHorizontal: 8,
  },
  createAccountPrompt: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#3F453E',
  },
  createAccountLink: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: '#2B8A38',
  },
});
