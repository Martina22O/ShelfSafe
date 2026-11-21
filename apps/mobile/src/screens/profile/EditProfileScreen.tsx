/**
 * Screen: EditProfileScreen
 * Updates the user's display name in Supabase auth user_metadata, preserving
 * other metadata. Displays email as read-only.
 */
import React, { useState, useEffect } from 'react';
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
// Lucide icons
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/types';
import { supabase } from '../../services/supabase';
import { isDatabaseError } from '../../services/inventory';
import { COLORS, FONTS, SCREEN_PADDING } from '../../theme';
import KeyboardAwareScreen from '../../components/KeyboardAwareScreen';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditProfile'>;

export default function EditProfileScreen({ navigation }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const bgHeight = screenWidth * (856 / 402);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loadingUser, setLoadingUser] = useState(true);

  const [saving, setSaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setName(user.user_metadata?.name || '');
        setEmail(user.email || '');
      }
      setLoadingUser(false);
    });
  }, []);

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

    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMessage('Name cannot be empty');
      return;
    }
    if (trimmed.length > 100) {
      setErrorMessage('Name cannot exceed 100 characters');
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
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      const existingMeta = currentUser?.user_metadata || {};

      const { error } = await supabase.auth.updateUser({
        data: {
          ...existingMeta,
          name: name.trim(),
        },
      });

      if (error) {
        setSaving(false);
        if (isDatabaseError(error)) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage(
            'Unable to save profile changes right now. Please check your network and try again.'
          );
        }
        return;
      }

      setSaving(false);
      setSuccessMessage('Profile updated successfully!');
      setTimeout(() => {
        navigation.goBack();
      }, 800);
    } catch {
      setSaving(false);
      setErrorMessage(
        'Unable to save profile changes right now. Please check your network and try again.'
      );
    }
  };

  if (loadingUser) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading account info...</Text>
      </SafeAreaView>
    );
  }

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
          Update your store operator name and account details
        </Text>

        {/* Success Banner */}
        {successMessage ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        ) : null}

        {/* Error Banner */}
        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Profile Form Card */}
        <View style={styles.card}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your name"
            placeholderTextColor={COLORS.textMuted}
            value={name}
            onChangeText={setName}
            maxLength={100}
            editable={!saving}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />

          <Text style={[styles.label, { marginTop: 14 }]}>Email Address</Text>
          <View style={styles.readOnlyInput}>
            <Text style={styles.readOnlyText}>{email}</Text>
          </View>
          <Text style={styles.hint}>Email changes are managed via administration</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.btnStack}>
          <TouchableOpacity
            style={[styles.primaryBtn, (saving || !name.trim()) && styles.btnDisabled]}
            onPress={handleOpenConfirm}
            disabled={saving || !name.trim()}
          >
            {saving ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.primaryBtnText}>Save Profile Changes</Text>
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
              <Text style={styles.modalTitle}>Save Profile Changes?</Text>
              <Text style={styles.modalSub}>
                Update your display name to "{name.trim()}"?
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bgWarm,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
  },
  content: {
    flex: 1,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 16,
    paddingBottom: 24,
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
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
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
  readOnlyInput: {
    backgroundColor: COLORS.borderLight,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  readOnlyText: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
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
