/**
 * Screen: CreateAccountScreen
 * Reference: docs/design/references/og-mobile.png
 *
 * Requirements:
 * - Shared decoupled AuthBackground in contain mode (no logo cropping or zooming).
 * - Rounded white card positioned identically to SignInScreen (~38% viewport height).
 * - Matches og-mobile.png layout, spacing, icons, and button styling.
 * - Handles keyboard smoothly with independent foreground scrolling.
 * - Full Supabase registration functionality preserved.
 */
import React, { useState, useRef, useEffect } from 'react';
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
import { Eye, EyeOff, ArrowLeft, ArrowRight, CheckCircle2, User, Mail, Lock } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { supabase } from '../../services/supabase';
import { COLORS, FONTS } from '../../theme';
import KeyboardAwareScreen from '../../components/KeyboardAwareScreen';
import AuthBackground from '../../components/AuthBackground';
import { setIsRegistering } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'CreateAccount'>;

export default function CreateAccountScreen({ navigation }: Props) {
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

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const emailInputRef = useRef<any>(null);
  const passwordInputRef = useRef<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleSignUp = async () => {
    Keyboard.dismiss();
    if (!name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    const trimmedEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter a password.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }

    setErrorMessage(null);
    setInfoMessage(null);
    setLoading(true);
    setIsRegistering(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            name: name.trim(),
          },
        },
      });

      if (error) {
        setIsRegistering(false);
        setLoading(false);
        setErrorMessage(error.message);
        return;
      }

      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setIsRegistering(false);
        setLoading(false);
        setErrorMessage('An account with this email already exists. Please sign in instead.');
        return;
      }

      // If Supabase created an active session automatically, safely sign out first
      if (data.session) {
        await supabase.auth.signOut();
      }

      setIsRegistering(false);
      setLoading(false);

      // Redirect newly registered user to Sign In with appropriate confirmation message
      const infoMsg = !data.session
        ? 'Account created! Please check your email to confirm your account before signing in.'
        : 'Account created successfully! Please sign in to continue.';

      navigation.navigate('SignIn', {
        registered: true,
        infoMessage: infoMsg,
      });
    } catch (err: any) {
      setIsRegistering(false);
      setLoading(false);
      setErrorMessage(err?.message || 'An unexpected error occurred during account creation.');
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
        - When keyboard is OPEN: scrollEnabled={true} -> smoothly adjusts so all fields & button remain accessible.
        - When keyboard dismisses: resets scroll to (0,0) and locks fixed again.
      */}
      <KeyboardAwareScreen
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        bottomOffset={24}
        scrollEnabled={isKeyboardVisible}
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
          {/* Rounded white authentication card matching SignInScreen */}
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
                <CheckCircle2 size={17} color="#2E8B3C" strokeWidth={2} />
                <Text style={styles.infoText}>{infoMessage}</Text>
              </View>
            ) : null}

            {/* Form Fields */}
            <View style={styles.formContainer}>
              {/* Full Name Field */}
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <User size={15} color="#2E8B3C" strokeWidth={2.3} />
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
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => emailInputRef.current?.focus()}
                />
              </View>

              {/* Email Field */}
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Mail size={15} color="#2E8B3C" strokeWidth={2.3} />
                  <Text style={styles.label}>Email</Text>
                </View>
                <TextInput
                  ref={emailInputRef}
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
                    placeholder="At least 8 characters"
                    placeholderTextColor="#8C948B"
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    secureTextEntry={!showPassword}
                    editable={!loading}
                    returnKeyType="done"
                    onSubmitEditing={handleSignUp}
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
                    <ArrowRight size={19} color={COLORS.white} strokeWidth={2.4} />
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
    fontSize: 27,
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
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.bgTint,
    borderWidth: 1,
    borderColor: '#d6f0b4',
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
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
    marginBottom: 11,
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
  helperText: {
    fontSize: 11.5,
    color: '#6B726A',
    marginTop: 3,
    marginLeft: 8,
    fontFamily: FONTS.regular,
  },
  primaryButton: {
    backgroundColor: '#2E8B3C',
    height: 50,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
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
  signInRow: {
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
  signInPrompt: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#4A5048',
  },
  signInLink: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: '#2E8B3C',
  },
});
