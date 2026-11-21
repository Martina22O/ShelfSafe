/**
 * Screen: ChangePasswordScreen
 * Verifies current password via signInWithPassword, enforces password constraints,
 * and updates password via updateUser. Never logs or displays passwords.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  BackHandler,
  StyleSheet,
  Image,
  useWindowDimensions,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Eye, EyeOff } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/types';
import { supabase } from '../../services/supabase';
import { isDatabaseError } from '../../services/inventory';
import { COLORS, FONTS, SCREEN_PADDING } from '../../theme';
import KeyboardAwareScreen from '../../components/KeyboardAwareScreen';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ChangePassword'>;

export default function ChangePasswordScreen({ navigation }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const bgHeight = screenWidth * (856 / 402);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const newPasswordRef = useRef<any>(null);
  const confirmPasswordRef = useRef<any>(null);

  const [saving, setSaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Block back navigation while saving
  useEffect(() => {
    const backAction = () => {
      if (saving) return true;
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [saving]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!saving) return;
      e.preventDefault();
    });
    return unsubscribe;
  }, [navigation, saving]);

  const handleOpenConfirm = () => {
    Keyboard.dismiss();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!currentPassword) {
      setErrorMessage('Please enter your current password');
      return;
    }
    if (!newPassword) {
      setErrorMessage('Please enter a new password');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters');
      return;
    }
    if (newPassword === currentPassword) {
      setErrorMessage('New password must be different from your current password');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirmation do not match');
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    setShowConfirmModal(false);
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !user.email) {
        setSaving(false);
        setErrorMessage('Unable to verify user session. Please sign in again.');
        return;
      }

      // Step 1: Re-authenticate with current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        setSaving(false);
        setErrorMessage('Current password is incorrect');
        return;
      }

      // Step 2: Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setSaving(false);
        if (isDatabaseError(updateError)) {
          setErrorMessage(updateError.message);
        } else {
          setErrorMessage(
            'Unable to change password right now. Please check your network and try again.'
          );
        }
        return;
      }

      setSaving(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMessage('Password changed successfully!');
      setTimeout(() => {
        navigation.goBack();
      }, 1000);
    } catch {
      setSaving(false);
      setErrorMessage(
        'Unable to change password right now. Please check your network and try again.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <StatusBar style="dark" />
      <Image
        source={require('../../../assets/designs/screen-background.png')}
        style={[styles.bgImage, { width: screenWidth, height: bgHeight }]}
        resizeMode="stretch"
      />
      <KeyboardAwareScreen
        contentContainerStyle={[styles.content, { flexGrow: 1 }]}
        bottomOffset={32}
      >
        <Text style={styles.screenSub}>
          Ensure your account stays protected with a strong password
        </Text>

        {/* Notifications */}
        {successMessage ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Form Card */}
        <View style={styles.card}>
          <Text style={styles.label}>Current Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Enter current password"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry={!showCurrentPassword}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              editable={!saving}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => newPasswordRef.current?.focus()}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowCurrentPassword(!showCurrentPassword)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={showCurrentPassword ? 'Hide current password' : 'Show current password'}
            >
              {showCurrentPassword ? (
                <EyeOff size={19} color={COLORS.textMuted} strokeWidth={2} />
              ) : (
                <Eye size={19} color={COLORS.textMuted} strokeWidth={2} />
              )}
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { marginTop: 14 }]}>New Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              ref={newPasswordRef}
              style={styles.passwordInput}
              placeholder="At least 8 characters"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry={!showNewPassword}
              value={newPassword}
              onChangeText={setNewPassword}
              editable={!saving}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => confirmPasswordRef.current?.focus()}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowNewPassword(!showNewPassword)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={showNewPassword ? 'Hide new password' : 'Show new password'}
            >
              {showNewPassword ? (
                <EyeOff size={19} color={COLORS.textMuted} strokeWidth={2} />
              ) : (
                <Eye size={19} color={COLORS.textMuted} strokeWidth={2} />
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>Must be at least 8 characters</Text>

          <Text style={[styles.label, { marginTop: 14 }]}>Confirm New Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              ref={confirmPasswordRef}
              style={styles.passwordInput}
              placeholder="Re-enter new password"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry={!showConfirmPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              editable={!saving}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
            >
              {showConfirmPassword ? (
                <EyeOff size={19} color={COLORS.textMuted} strokeWidth={2} />
              ) : (
                <Eye size={19} color={COLORS.textMuted} strokeWidth={2} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.btnStack}>
          <TouchableOpacity
            style={[styles.primaryBtn, saving && styles.btnDisabled]}
            onPress={handleOpenConfirm}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.primaryBtnText}>Update Password</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigation.goBack()}
            disabled={saving}
          >
            <Text style={styles.secondaryBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Confirmation Modal */}
        <Modal
          visible={showConfirmModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            if (!saving) setShowConfirmModal(false);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Change Password?</Text>
              <Text style={styles.modalSub}>
                Are you sure you want to change your login password?
              </Text>

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowConfirmModal(false)}
                  disabled={saving}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={handleConfirmSave}
                  disabled={saving}
                >
                  <Text style={styles.modalConfirmText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAwareScreen>
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
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 16,
    paddingBottom: 24,
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  topNav: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.deepGreen,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.deepGreen,
    letterSpacing: -0.4,
  },
  screenSub: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 20,
  },
  successBox: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  successText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FONTS.semiBold,
    color: COLORS.primaryDark,
  },
  errorBox: {
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FONTS.semiBold,
    color: COLORS.danger,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    minHeight: 48,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    minHeight: 48,
    paddingLeft: 14,
    paddingRight: 8,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  eyeButton: {
    padding: 8,
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  btnStack: {
    marginTop: 24,
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },
  secondaryBtn: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 14,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
  },
  modalSub: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 6,
    lineHeight: 20,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FONTS.semiBold,
    color: COLORS.textMuted,
  },
  modalConfirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },
});
