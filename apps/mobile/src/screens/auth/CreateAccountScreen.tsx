/**
 * Screen: CreateAccountScreen
 * Background: apps/mobile/assets/designs/mobile-bg.png (1708x3684 HD)
 * Reference: docs/design/references/mobilenew-signin-reference.jpg
 * Elements:
 * - Full-height HD background with logo & yellow wave (identical scaling & positioning to SignInScreen)
 * - Accessible back button to landing
 * - Floating rounded form card positioned right along the inner curve of the yellow wave
 * - "Create Your Account" heading & "Start keeping your shelves in check." subtitle with green swoosh
 * - Full Name, Email, and Password fields with visibility toggle
 * - Password requirement helper text
 * - Large green pill "Create Account ->" button
 * - "Already have an account? Sign In" link with divider lines
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
import { Eye, EyeOff, ArrowLeft, ArrowRight, CheckCircle2, User, Mail, Lock } from 'lucide-react-native';
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

  // mobile-bg.png is 1708x3684 (aspect ratio 1842/854). Scale proportionally to screen width so the background matches SignInScreen identically.
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
                <Text style={styles.title}>Create Your Account</Text>
                <Text style={styles.subtitle}>Start keeping your shelves in check.</Text>
                <View style={styles.swoosh} />
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
                  <CheckCircle2 size={18} color="#2E8B3C" strokeWidth={2} />
                  <Text style={styles.infoText}>{infoMessage}</Text>
                </View>
              ) : null}

              {/* Form Fields */}
              <View style={styles.formContainer}>
                {/* Full Name Field */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <User size={17} color="#2B8A38" strokeWidth={2.3} />
                    <Text style={styles.label}>Full Name</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Juan Dela Cruz"
                    placeholderTextColor="#8C948B"
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
                      placeholder="At least 8 characters"
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
                    <View style={styles.buttonContentRow}>
                      <Text style={styles.primaryButtonText}>Create Account</Text>
                      <ArrowRight size={20} color={COLORS.white} strokeWidth={2.4} />
                    </View>
                  )}
                </TouchableOpacity>

                {/* Link to Sign In with subtle horizontal lines */}
                <View style={styles.signInRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.signInPrompt}>Already have an account? </Text>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('SignIn')}
                    accessibilityRole="button"
                  >
                    <Text style={styles.signInLink}>Sign In</Text>
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
    paddingTop: 26,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#144721',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 4,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
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
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.bgTint,
    borderWidth: 1,
    borderColor: '#d6f0b4',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    color: '#2E8B3C',
    fontSize: 13,
    fontFamily: FONTS.medium,
  },
  formContainer: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
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
  helperText: {
    fontSize: 12,
    color: '#6B726A',
    marginTop: 5,
    marginLeft: 10,
    fontFamily: FONTS.regular,
  },
  primaryButton: {
    backgroundColor: '#2E8B3C',
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
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
  signInRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
    paddingVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E1E3DC',
    marginHorizontal: 8,
  },
  signInPrompt: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#3F453E',
  },
  signInLink: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: '#2B8A38',
  },
});
