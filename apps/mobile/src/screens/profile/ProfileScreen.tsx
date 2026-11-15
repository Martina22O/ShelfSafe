/**
 * Screen: ProfileScreen
 * Reference: docs/design/mobile/06-profile/profile_mobile.png
 * Features:
 * - Operator avatar with initials in brand green
 * - Store details and operator identity
 * - Settings menu rows with chevrons
 * - Sign out confirmation modal clearing cart and store settings
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Modal,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ChevronRight, ArrowRight, Lock, Bell, RefreshCw } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import { ProfileStackParamList } from '../../navigation/types';
import { supabase } from '../../services/supabase';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { useSaleCart } from '../../context/SaleCartContext';
import { COLORS, FONTS, SCREEN_PADDING } from '../../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Profile'>;

export default function ProfileScreen({ navigation }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const { width: screenWidth } = useWindowDimensions();
  const bgHeight = screenWidth * (856 / 402);
  const { store_name, contact_number, clearStoreSettings } = useStoreSettings();
  const { clearCart } = useSaleCart();

  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const loadUserData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      setUserName(user.user_metadata?.name || '');
      setUserEmail(user.email || '');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [loadUserData])
  );

  const handleConfirmSignOut = async () => {
    setSigningOut(true);
    try {
      clearCart();
      clearStoreSettings();
      await supabase.auth.signOut();
    } finally {
      setShowSignOutConfirm(false);
      setSigningOut(false);
    }
  };

  const userInitial = (userName || userEmail || 'O').charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent}>
          {/* Screen Background Image with Yellow Wave (scrolls naturally with content) */}
          <Image
            source={require('../../../assets/designs/screen-background.png')}
            style={[styles.bgImage, { width: screenWidth, height: bgHeight }]}
            resizeMode="stretch"
          />

          {/* Top Logo Row */}
          <View style={styles.topLogoRow}>
            <Image
              source={require('../../../assets/designs/shelfsafe-logo.jpg')}
              style={styles.screenLogo}
              resizeMode="contain"
            />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Profile & Settings</Text>
            <Text style={styles.subtitle}>Manage operator identity and store preferences</Text>
          </View>

          {/* Operator Profile Card */}
          <View style={styles.profileCard}>
            <View style={styles.avatarRow}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{userInitial}</Text>
              </View>
              <View style={styles.avatarInfo}>
                <Text style={styles.userNameText}>{userName || 'Store Operator'}</Text>
                <Text style={styles.userEmailText}>{userEmail || 'Active session'}</Text>
              </View>
            </View>

          <TouchableOpacity
            style={styles.editProfileBtn}
            onPress={() => navigation.navigate('EditProfile')}
            disabled={signingOut}
          >
            <Text style={styles.editProfileText}>Edit Profile Identity</Text>
            <ArrowRight size={14} color={COLORS.primary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Store Details Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionCardHeader}>
            <Text style={styles.sectionTitle}>Store Details</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('EditStore')}
              disabled={signingOut}
            >
              <Text style={styles.editSectionLink}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.storeDetailRow}>
            <Text style={styles.storeDetailLabel}>Store Name</Text>
            <Text style={styles.storeDetailVal}>{store_name || 'Retail Inventory Store'}</Text>
          </View>

          <View style={styles.storeDetailRow}>
            <Text style={styles.storeDetailLabel}>Contact</Text>
            <Text style={styles.storeDetailVal}>{contact_number || 'Not provided'}</Text>
          </View>
        </View>

        {/* Security & Preferences Card */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Preferences & Security</Text>

          <TouchableOpacity
            style={styles.navRow}
            onPress={() => navigation.navigate('ChangePassword')}
            disabled={signingOut}
          >
            <View style={styles.navRowLeft}>
              <Lock size={16} color={COLORS.textSecondary} strokeWidth={2} />
              <Text style={styles.navRowLabel}>Change Password</Text>
            </View>
            <ChevronRight size={18} color={COLORS.textTertiary} strokeWidth={2} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navRow}
            onPress={() => navigation.navigate('NotificationPreferences')}
            disabled={signingOut}
          >
            <View style={styles.navRowLeft}>
              <Bell size={16} color={COLORS.textSecondary} strokeWidth={2} />
              <Text style={styles.navRowLabel}>Notification Preferences</Text>
            </View>
            <ChevronRight size={18} color={COLORS.textTertiary} strokeWidth={2} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navRow, { borderBottomWidth: 0 }]}
            onPress={() => navigation.navigate('SyncStatus')}
            disabled={signingOut}
          >
            <View style={styles.navRowLeft}>
              <RefreshCw size={16} color={COLORS.textSecondary} strokeWidth={2} />
              <Text style={styles.navRowLabel}>Sync & Connectivity Status</Text>
            </View>
            <ChevronRight size={18} color={COLORS.textTertiary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={() => setShowSignOutConfirm(true)}
          disabled={signingOut}
        >
          <Text style={styles.signOutBtnText}>
            {signingOut ? 'Signing out...' : 'Sign Out'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Sign Out Confirmation Modal */}
      <Modal
        visible={showSignOutConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!signingOut) setShowSignOutConfirm(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Sign Out?</Text>
            <Text style={styles.modalDesc}>
              Are you sure you want to sign out? Your current active cart and local session will be safely cleared.
            </Text>

            {signingOut ? (
              <ActivityIndicator color={COLORS.danger} style={{ marginVertical: 16 }} />
            ) : (
              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowSignOutConfirm(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSignOutBtn}
                  onPress={handleConfirmSignOut}
                >
                  <Text style={styles.modalSignOutText}>Sign Out</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.canvas,
  },
  safeArea: {
    flex: 1,
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  scrollContent: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 16,
    paddingBottom: 36,
  },
  topLogoRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 6,
  },
  screenLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  header: {
    marginBottom: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  profileCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.bgTint,
    borderWidth: 1.5,
    borderColor: '#d6f0b4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '900',
    fontFamily: FONTS.black,
    color: COLORS.primary,
  },
  avatarInfo: {
    flex: 1,
  },
  userNameText: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  userEmailText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  fefoActiveBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.bgTint,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d6f0b4',
    marginTop: 4,
  },
  fefoActiveText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.primary,
  },
  editProfileBtn: {
    backgroundColor: COLORS.bgWarm,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  editProfileText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  editSectionLink: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  storeDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  storeDetailLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  storeDetailVal: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  navRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  navRowIcon: {
    fontSize: 16,
  },
  navRowLabel: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.text,
  },
  navRowChevron: {
    fontSize: 20,
    color: COLORS.textSubtle,
    fontWeight: '300',
  },
  signOutBtn: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.dangerBorder,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  signOutBtnText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.danger,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    lineHeight: 18,
    marginBottom: 20,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  modalSignOutBtn: {
    backgroundColor: COLORS.danger,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalSignOutText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
});
