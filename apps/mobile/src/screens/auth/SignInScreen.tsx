/**
 * Screen: SignInScreen
 * Reference: docs/design/references/og-mobile.png
 *
 * Requirements:
 * - Shared decoupled AuthBackground in contain mode (no logo cropping or zooming).
 * - Rounded white card positioned below the ShelfSafe branding and yellow wave (~38% viewport height).
 * - Matches og-mobile.png layout, spacing, icons, and button styling.
 * - Handles keyboard smoothly with independent foreground scrolling.
 * - Full Supabase authentication functionality preserved.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Keyboard,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Eye, EyeOff, ArrowLeft, ArrowRight, Mail, Lock, CheckCircle2 } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { supabase } from '../../services/supabase';
import { COLORS, FONTS } from '../../theme';
import KeyboardAwareScreen from '../../components/KeyboardAwareScreen';
import AuthBackground from '../../components/AuthBackground';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export default function SignInScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  // Physical screen height ensures cardTopMargin is completely stationary and never shifts when keyboard opens
  const screenHeight = Dimensions.get('screen').height;

  // Position the card cleanly beneath the yellow wave (which reaches ~42.1% of viewport height).
  // 44.5% provides a crisp, balanced visual gap without overlapping the wave decoration.
  const cardTopMargin = Math.max(
    Math.round(screenHeight * 0.445),
    insets.top + 250
  );

  const scrollRef = useRef<any>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const passwordInputRef = useRef<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(
    route?.params?.infoMessage ||
      (route?.params?.registered
        ? 'Account created successfully! Please sign in to continue.'
        : null)
  );

  useEffect(() => {
    if (route?.params?.infoMessage) {
      setInfoMessage(route.params.infoMessage);
    } else if (route?.params?.registered) {
      setInfoMessage('Account created successfully! Please sign in to continue.');
    }
  }, [route?.params?.registered, route?.params?.infoMessage]);

  const handleLogin = async () => {
    Keyboard.dismiss();
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }
    setErrorMessage(null);
    setInfoMessage(null);
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

      {/* Shared decoupled contained background layer */}
      <AuthBackground />

      {/* Top back button */}
      {navigation.canGoBack() && (
        <TouchableOpacity
          style={[styles.backButton, { top: insets.top + 8 }]}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={20} color="#164A23" strokeWidth={2.2} />
        </TouchableOpacity>
      )}

      {/*
        Foreground content:
        - When keyboard is CLOSED: scrollEnabled={false}, bounces={false} -> 100% stationary, immovable card.
        - When keyboard is OPEN: scrollEnabled={true} -> smoothly adjusts so the focused field & button remain accessible.
        - When keyboard dismisses: resets scroll to (0,0) and locks fixed again.
      */}
      <KeyboardAwareScreen
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        bottomOffset={24}
        scrollEnabled={Platform.OS === 'web' ? true : isKeyboardVisible}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
      >
        <View
          style={[
            styles.cardOuterWrapper,
            {
              paddingTop: cardTopMargin,
              paddingBottom: Math.max(insets.bottom, 16) + 12,
            },
          ]}
        >
          {/* Rounded white authentication card matching og-mobile.png */}
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>Sign In</Text>
              <Text style={styles.subtitle}>Welcome back to ShelfSafe!</Text>
              <View style={styles.swoosh} />
            </View>

            {/* Success / Info Confirmation Banner */}
            {infoMessage ? (
              <View style={styles.successBox}>
                <CheckCircle2 size={16} color="#15803d" strokeWidth={2.3} style={{ marginTop: 2, marginRight: 8, flexShrink: 0 }} />
                <Text style={styles.successText}>{infoMessage}</Text>
              </View>
            ) : null}

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
                  <Mail size={15} color="#2E8B3C" strokeWidth={2.3} />
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
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                />
              </View>

              {/* Password Field */}
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Lock size={15} color="#2E8B3C" strokeWidth={2.3} />
                  <Text style={styles.label}>Password</Text>
                </View>
                <View style={styles.passwordContainer}>
                  <TextInput
                    ref={passwordInputRef}
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
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                    activeOpacity={0.7}
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    accessibilityRole="button"
                  >
                    {showPassword ? (
                      <EyeOff size={19} color="#747B73" strokeWidth={2} />
                    ) : (
                      <Eye size={19} color="#747B73" strokeWidth={2} />
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
                    <ArrowRight size={19} color={COLORS.white} strokeWidth={2.4} />
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
      </KeyboardAwareScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FCF9EA',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E6DF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  scrollContent: {
    flexGrow: 1,
    zIndex: 1,
  },
  cardOuterWrapper: {
    paddingHorizontal: 16,
    width: '100%',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 36,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(230, 230, 225, 0.85)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 4,
  },
  header: {
    marginBottom: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: '#164A23',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#4A5048',
    marginTop: 2,
  },
  swoosh: {
    marginTop: 5,
    width: 68,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#2E8B3C',
    transform: [{ rotate: '-1.5deg' }],
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  successText: {
    color: '#15803d',
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    flex: 1,
    lineHeight: 18,
  },
  errorBox: {
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
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
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 5,
    paddingLeft: 2,
  },
  label: {
    fontSize: 13.5,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: '#1B5728',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8DDD5',
    borderRadius: 999,
    height: 48,
    paddingHorizontal: 16,
    fontSize: 14.5,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8DDD5',
    borderRadius: 999,
    height: 48,
    paddingLeft: 16,
    paddingRight: 10,
  },
  passwordInput: {
    flex: 1,
    height: 48,
    fontSize: 14.5,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  eyeButton: {
    padding: 6,
    minWidth: 38,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: 2,
    marginBottom: 12,
    paddingVertical: 2,
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
    height: 50,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2E8B3C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
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
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    letterSpacing: -0.2,
  },
  createAccountRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E6DF',
    marginHorizontal: 8,
  },
  createAccountPrompt: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#4A5048',
  },
  createAccountLink: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: '#2E8B3C',
  },
});
