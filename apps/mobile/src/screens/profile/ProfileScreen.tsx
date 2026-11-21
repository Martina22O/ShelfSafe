/**
 * Screen: ProfileScreen
 * Reference: docs/design/mobile/06-profile/profile_mobile.png
 * Features:
 * - Operator avatar with initials in brand green
 * - Store details and operator identity
 * - Settings menu rows with chevrons
 * - Sign out confirmation modal clearing cart and store settings
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { ChevronRight, ArrowRight, Lock, Bell, RefreshCw, Sparkles } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, useScrollToTop, useIsFocused } from '@react-navigation/native';
import { ProfileStackParamList } from '../../navigation/types';
import { supabase } from '../../services/supabase';
import { getUserSubscription, UserSubscription } from '../../services/subscription';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { useSaleCart } from '../../context/SaleCartContext';
import { useRealtime } from '../../services/realtime';
import { COLORS, FONTS, SCREEN_PADDING } from '../../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Profile'>;

export default function ProfileScreen({ navigation }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const { width: screenWidth } = useWindowDimensions();
  const bgHeight = screenWidth * (856 / 402);
  const { store_name, contact_number, clearStoreSettings } = useStoreSettings();
  const { clearCart } = useSaleCart();
  const isFocused = useIsFocused();
  const { dataVersion } = useRealtime();

  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [subLoading, setSubLoading] = useState(false);

  const loadUserData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      setUserName(user.user_metadata?.name || '');
      setUserEmail(user.email || '');
    }

    setSubLoading(true);
    try {
      const res = await getUserSubscription();
      if (res.success && res.data) {
        setSubscription(res.data);
      } else {
        setSubscription(null);
      }
    } catch {
      setSubscription(null);
    } finally {
      setSubLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [loadUserData])
  );

  // Silent background refresh when subscription or profile changes on another device
  useEffect(() => {
    if (!isFocused || dataVersion === 0) return;
    void loadUserData();
  }, [dataVersion, isFocused, loadUserData]);

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

        {/* Subscription Plan Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionCardHeader}>
            <Text style={styles.sectionTitle}>Subscription</Text>
            {subLoading ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <View
                style={[
                  styles.planBadge,
                  subscription?.status === 'trialing'
                    ? styles.planBadgeTrial
                    : subscription?.is_premium
                    ? styles.planBadgePremium
                    : styles.planBadgeFree,
                ]}
              >
                <Text style={styles.planBadgeText}>
                  {subscription?.status === 'trialing'
                    ? '14-Day Trial'
                    : subscription?.is_premium
                    ? 'Premium'
                    : 'Free Plan'}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.navRow, { borderBottomWidth: 0, paddingVertical: 8 }]}
            onPress={() => navigation.navigate('Subscription')}
            disabled={signingOut}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.navRowLabel}>Subscription & Plans</Text>
              <Text style={styles.subPlanHint}>
                {subscription?.status === 'trialing'
                  ? `${subscription.days_remaining ?? 14} days left in trial`
                  : subscription?.is_premium
                  ? 'All features unlocked'
                  : 'Upgrade or view 14-day trial'}
              </Text>
            </View>
            <ChevronRight size={18} color={COLORS.textTertiary} strokeWidth={2} />
          </TouchableOpacity>
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
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  profileCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
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
    fontSize: 17,
    fontWeight: '800',
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  userEmailText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 2,
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
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary,
  },
  editProfileBtn: {
    backgroundColor: COLORS.bgWarm,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 11,
    minHeight: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  editProfileText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
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
    fontSize: 14,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  editSectionLink: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  storeDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  storeDetailLabel: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
  },
  storeDetailVal: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    minHeight: 48,
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
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  navRowChevron: {
    fontSize: 20,
    color: COLORS.textSubtle,
    fontWeight: '300',
  },
  planBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  planBadgeTrial: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  planBadgePremium: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  planBadgeFree: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  planBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  subPlanHint: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  signOutBtn: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.dangerBorder,
    paddingVertical: 14,
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  signOutBtnText: {
    fontSize: 15,
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
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    lineHeight: 20,
    marginBottom: 20,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.textMuted,
  },
  modalSignOutBtn: {
    backgroundColor: COLORS.danger,
    paddingHorizontal: 18,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSignOutText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },
});
