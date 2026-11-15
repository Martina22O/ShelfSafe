/**
 * Screen: EditStoreScreen
 * Updates store details (store name and contact number) via save_store_details.
 * Refreshes StoreSettingsContext after saving.
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
// Lucide icons
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/types';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { saveStoreDetails } from '../../services/storeSettings';
import { COLORS, FONTS, SCREEN_PADDING } from '../../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditStore'>;

export default function EditStoreScreen({ navigation }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const bgHeight = screenWidth * (856 / 402);
  const { store_name, contact_number, refresh } = useStoreSettings();

  const [storeName, setStoreName] = useState(store_name || '');
  const [contactNumber, setContactNumber] = useState(contact_number || '');

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
    setErrorMessage(null);
    setSuccessMessage(null);

    if (storeName.trim().length > 100) {
      setErrorMessage('Store name cannot exceed 100 characters');
      return;
    }
    if (contactNumber.trim().length > 30) {
      setErrorMessage('Contact number cannot exceed 30 characters');
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    setShowConfirmModal(false);
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await saveStoreDetails({
      storeName: storeName.trim(),
      contactNumber: contactNumber.trim(),
    });

    if (res.kind !== 'success') {
      setSaving(false);
      setErrorMessage(res.message);
      return;
    }

    await refresh();
    setSaving(false);
    setSuccessMessage('Store details updated successfully!');
    setTimeout(() => {
      navigation.goBack();
    }, 800);
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <StatusBar style="dark" />
      <Image
        source={require('../../../assets/designs/screen-background.png')}
        style={[styles.bgImage, { width: screenWidth, height: bgHeight }]}
        resizeMode="stretch"
      />
      <View style={styles.content}>
        <Text style={styles.screenSub}>
          Configure public store name and support contact number
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

        {/* Store Details Card */}
        <View style={styles.card}>
          <Text style={styles.label}>Store Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Sari-Sari Store or Mini Mart"
            placeholderTextColor={COLORS.textMuted}
            value={storeName}
            onChangeText={setStoreName}
            maxLength={100}
            editable={!saving}
          />
          <Text style={styles.hint}>At most 100 characters</Text>

          <Text style={[styles.label, { marginTop: 16 }]}>Contact Number</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 0917-123-4567"
            placeholderTextColor={COLORS.textMuted}
            value={contactNumber}
            onChangeText={setContactNumber}
            maxLength={30}
            keyboardType="phone-pad"
            editable={!saving}
          />
          <Text style={styles.hint}>Optional contact number for your branch</Text>
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
              <Text style={styles.primaryBtnText}>Save Store Details</Text>
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
              <Text style={styles.modalTitle}>Save Store Details?</Text>
              <Text style={styles.modalSub}>
                Update store name to "{storeName.trim() || 'ShelfSafe Store'}"?
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
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: 16,
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
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: {
    fontSize: 13,
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
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  hint: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  btnStack: {
    marginTop: 24,
    gap: 10,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
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
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.deepGreen,
  },
  modalSub: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    marginTop: 6,
    lineHeight: 18,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  modalCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FONTS.semiBold,
    color: COLORS.textMuted,
  },
  modalConfirmBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  modalConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },
});
