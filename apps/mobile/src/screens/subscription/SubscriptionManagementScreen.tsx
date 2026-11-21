/**
 * Screen: SubscriptionManagementScreen
 * Accessible from Profile -> Subscription Plan.
 * Background: apps/mobile/assets/designs/screen-background.png
 * Features:
 * - Current subscription status (Free / 14-Day Trial / Premium)
 * - Days remaining countdown and expiration date
 * - Auto-renewal setting and cancellation controls
 * - Full list of subscription plans (₱99, ₱189, ₱289, ₱499)
 * - Standard payment details checkout modal with dummy card validation
 * - Small demo disclosure
 * - Feature comparison between Free and Premium
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  Alert,
  Modal,
  TextInput,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ChevronRight,
  CreditCard,
  X,
  RotateCcw,
  Ban,
  CheckSquare,
  Square,
  AlertCircle,
} from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/types';
import { COLORS, FONTS } from '../../theme';
import {
  getUserSubscription,
  startFreeTrial,
  simulateSubscriptionPayment,
  cancelSubscription,
  renewSubscription,
  setSubscriptionAutoRenew,
  validateTestCard,
  TEST_CARDS,
  SUBSCRIPTION_PLANS,
  UserSubscription,
  SubscriptionPlan,
  TestCardDetails,
} from '../../services/subscription';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Subscription'>;

const KeyboardAvoidingViewComponent = KeyboardAvoidingView as any;

export default function SubscriptionManagementScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get('window').width;
  const bgHeight = Math.round(screenWidth * (440 / 390));

  const [loading, setLoading] = useState(true);
  const [activatingTrial, setActivatingTrial] = useState(false);
  const [simulatingPayment, setSimulatingPayment] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);

  // Checkout Modal State
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<SubscriptionPlan | null>(null);
  const [cardDetails, setCardDetails] = useState<TestCardDetails>({
    cardholderName: 'Juan Dela Cruz',
    cardNumber: '4242 4242 4242 4242',
    expiryDate: '12/28',
    cvv: '123',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // Input refs for keyboard Next / Done navigation
  const cardNumberInputRef = useRef<any>(null);
  const expiryInputRef = useRef<any>(null);
  const cvvInputRef = useRef<any>(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setIsKeyboardOpen(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setIsKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const fetchSubscription = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getUserSubscription();
      if (res.success && res.data) {
        setSubscription(res.data);
      }
    } catch {
      // Safely handle errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const handleActivateTrial = async () => {
    if (activatingTrial) return;
    setActivatingTrial(true);

    try {
      const res = await startFreeTrial();
      if (res.success) {
        Alert.alert('Trial Activated!', 'Your 14-day Premium trial is now active.');
        await fetchSubscription();
      } else {
        Alert.alert('Notice', res.error || 'Failed to activate trial.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not activate trial.');
    } finally {
      setActivatingTrial(false);
    }
  };

  const handleOpenCheckout = (plan: SubscriptionPlan) => {
    setSelectedPlanForCheckout(plan);
    setFormError(null);
    setCardDetails({
      cardholderName: TEST_CARDS[0].cardholderName,
      cardNumber: TEST_CARDS[0].cardNumber,
      expiryDate: TEST_CARDS[0].expiryDate,
      cvv: TEST_CARDS[0].cvv,
    });
  };

  const handleSelectCard = (testCard: typeof TEST_CARDS[0]) => {
    Keyboard.dismiss();
    setCardDetails({
      cardholderName: testCard.cardholderName,
      cardNumber: testCard.cardNumber,
      expiryDate: testCard.expiryDate,
      cvv: testCard.cvv,
    });
    setFormError(null);
  };

  const handleCloseCheckout = () => {
    Keyboard.dismiss();
    setSelectedPlanForCheckout(null);
  };

  const handleFormatCardNumber = (value: string) => {
    const raw = value.replace(/\D/g, '').slice(0, 16);
    const parts = raw.match(/[\s\S]{1,4}/g) || [];
    setCardDetails((prev) => ({ ...prev, cardNumber: parts.join(' ') }));
  };

  const handleFormatExpiry = (value: string) => {
    const raw = value.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 3) {
      setCardDetails((prev) => ({ ...prev, expiryDate: `${raw.slice(0, 2)}/${raw.slice(2)}` }));
    } else {
      setCardDetails((prev) => ({ ...prev, expiryDate: raw }));
    }
  };

  const handleConfirmSubscription = async () => {
    Keyboard.dismiss();
    if (!selectedPlanForCheckout || simulatingPayment) return;

    const validation = validateTestCard(cardDetails);
    if (!validation.isValid) {
      setFormError(validation.error || 'Please check your card details.');
      return;
    }

    setSimulatingPayment(true);
    setFormError(null);

    try {
      const res = await simulateSubscriptionPayment(selectedPlanForCheckout.id);
      if (res.success) {
        setSelectedPlanForCheckout(null);
        Alert.alert(
          'Payment Successful',
          `You are now subscribed to ${selectedPlanForCheckout.name}. Premium features are active.`,
          [{ text: 'Great' }]
        );
        await fetchSubscription();
      } else {
        setFormError(res.error || 'Payment failed. Please try again.');
      }
    } catch (err: any) {
      setFormError(err?.message || 'Error executing payment.');
    } finally {
      setSimulatingPayment(false);
    }
  };

  const handleToggleAutoRenew = async () => {
    if (processingAction || !subscription) return;
    setProcessingAction(true);

    const targetVal = !(subscription.auto_renew ?? true);

    try {
      const res = await setSubscriptionAutoRenew(targetVal);
      if (res.success) {
        Alert.alert(
          'Auto-Renew Updated',
          targetVal
            ? 'Auto-renewal has been enabled.'
            : 'Auto-renewal has been turned off. Your subscription will expire at the end of the billing period.'
        );
        await fetchSubscription();
      } else {
        Alert.alert('Notice', res.error || 'Failed to update auto-renewal.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Error updating auto-renew.');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleConfirmCancel = () => {
    Alert.alert(
      'Cancel Subscription?',
      `Auto-renewal will be turned off. You will retain full Premium access until ${formatDate(subscription?.current_period_end)}. ShelfSafe will never delete your store data.`,
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Confirm Cancellation',
          style: 'destructive',
          onPress: async () => {
            setProcessingAction(true);
            try {
              const res = await cancelSubscription();
              if (res.success) {
                Alert.alert(
                  'Subscription Cancelled',
                  'Auto-renewal turned off. You will retain Premium access until the period ends.'
                );
                await fetchSubscription();
              } else {
                Alert.alert('Notice', res.error || 'Failed to cancel subscription.');
              }
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Error cancelling subscription.');
            } finally {
              setProcessingAction(false);
            }
          },
        },
      ]
    );
  };

  const handleRenewNow = async () => {
    if (processingAction) return;
    setProcessingAction(true);

    try {
      const res = await renewSubscription();
      if (res.success) {
        Alert.alert(
          'Subscription Renewed',
          'Your billing period has been extended and auto-renewal is enabled.'
        );
        await fetchSubscription();
      } else {
        Alert.alert('Notice', res.error || 'Failed to renew subscription.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Error renewing subscription.');
    } finally {
      setProcessingAction(false);
    }
  };

  const isTrial = subscription?.status === 'trialing';
  const isPremium = subscription?.is_premium;
  const isEligibleForTrial = subscription?.status === 'free' && subscription?.trial_eligible;
  const autoRenewEnabled = subscription?.auto_renew ?? true;

  const formatDate = (isoString: string | null | undefined) => {
    if (!isoString) return 'N/A';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Yellow Wave Background Asset */}
        <Image
          source={require('../../../assets/designs/screen-background.png')}
          style={[styles.bgImage, { width: screenWidth, height: bgHeight }]}
          resizeMode="stretch"
        />

        <View style={styles.contentWrapper}>
          {/* Header Description */}
          <View style={styles.header}>
            <Text style={styles.description}>
              Manage your plan and explore available options.
            </Text>
          </View>

          {/* Current Status Card */}
          <View style={styles.statusCard}>
            <View style={styles.statusHeaderRow}>
              <Text style={styles.statusSectionLabel}>CURRENT PLAN</Text>
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <View
                  style={[
                    styles.statusBadge,
                    isTrial
                      ? styles.statusBadgeTrial
                      : isPremium
                      ? styles.statusBadgePremium
                      : styles.statusBadgeFree,
                  ]}
                >
                  <Text style={styles.statusBadgeText}>
                    {isTrial
                      ? '14-Day Free Trial'
                      : isPremium
                      ? 'Premium Active'
                      : subscription?.status === 'expired'
                      ? 'Expired'
                      : 'Free Plan'}
                  </Text>
                </View>
              )}
            </View>

            {isTrial ? (
              <View style={styles.trialInfoBox}>
                <View style={styles.trialInfoRow}>
                  <Clock size={16} color={COLORS.primary} />
                  <Text style={styles.trialCountdown}>
                    {subscription?.days_remaining ?? 14} days remaining
                  </Text>
                </View>
                <Text style={styles.trialExpiresText}>
                  Trial ends on {formatDate(subscription?.trial_ends_at)}
                </Text>
              </View>
            ) : isPremium ? (
              <View style={styles.premiumInfoBox}>
                <Text style={styles.premiumPlanName}>
                  {subscription?.plan_name || 'Active Premium Membership'}
                </Text>
                <Text style={styles.premiumExpiresText}>
                  Period: {formatDate(subscription?.current_period_start)} – {formatDate(subscription?.current_period_end)}
                </Text>
                <Text style={styles.premiumDaysRemaining}>
                  {subscription?.days_remaining ?? 0} days remaining
                </Text>

                <View style={styles.autoRenewRow}>
                  <View style={styles.autoRenewStatus}>
                    {autoRenewEnabled ? (
                      <CheckCircle2 size={14} color={COLORS.primary} />
                    ) : (
                      <AlertCircle size={14} color="#D97706" />
                    )}
                    <Text
                      style={[
                        styles.autoRenewStatusText,
                        { color: autoRenewEnabled ? COLORS.primary : '#D97706' },
                      ]}
                    >
                      {autoRenewEnabled ? 'Auto-Renew: ON' : 'Cancels at Period End'}
                    </Text>
                  </View>
                </View>

                {/* Active Management Action Buttons */}
                <View style={styles.premiumActionButtonsRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnRenew]}
                    onPress={handleRenewNow}
                    disabled={processingAction}
                    activeOpacity={0.8}
                  >
                    <RotateCcw size={14} color="#FFFFFF" />
                    <Text style={styles.actionBtnRenewText}>Renew Plan</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnOutline]}
                    onPress={handleToggleAutoRenew}
                    disabled={processingAction}
                    activeOpacity={0.8}
                  >
                    {autoRenewEnabled ? (
                      <CheckSquare size={14} color={COLORS.primary} />
                    ) : (
                      <Square size={14} color={COLORS.textSecondary} />
                    )}
                    <Text style={styles.actionBtnOutlineText}>Auto-Renew</Text>
                  </TouchableOpacity>

                  {autoRenewEnabled && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnCancel]}
                      onPress={handleConfirmCancel}
                      disabled={processingAction}
                      activeOpacity={0.8}
                    >
                      <Ban size={14} color="#DC2626" />
                      <Text style={styles.actionBtnCancelText}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.freeInfoBox}>
                <Text style={styles.freeLimitsTitle}>Free Plan Limits</Text>
                <Text style={styles.freeLimitsText}>
                  • Up to 20 active products{'\n'}
                  • Up to 5 product photos{'\n'}
                  • 7-day sales history window
                </Text>

                {isEligibleForTrial && (
                  <TouchableOpacity
                    style={[styles.activateTrialBtn, activatingTrial && styles.btnDisabled]}
                    onPress={handleActivateTrial}
                    disabled={activatingTrial}
                    activeOpacity={0.85}
                  >
                    {activatingTrial ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Sparkles size={16} color="#FFFFFF" />
                        <Text style={styles.activateTrialBtnText}>Start 14-Day Free Trial</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Plan Comparison Section */}
          <View style={styles.plansHeaderRow}>
            <Text style={styles.sectionTitle}>Available Plans</Text>
          </View>

          <View style={styles.plansList}>
            {SUBSCRIPTION_PLANS.map((plan) => {
              const isCurrentPlan = subscription?.is_premium && subscription?.plan_id === plan.id;
              return (
                <TouchableOpacity
                  key={plan.id}
                  style={[
                    styles.planItemCard,
                    isCurrentPlan
                      ? styles.planItemCardActive
                      : plan.isPopular
                      ? styles.planItemCardPopular
                      : null,
                  ]}
                  onPress={() => handleOpenCheckout(plan)}
                  activeOpacity={0.8}
                >
                  {isCurrentPlan ? (
                    <View style={styles.planItemActiveBadge}>
                      <Text style={styles.planItemPopularText}>ACTIVE</Text>
                    </View>
                  ) : plan.isPopular ? (
                    <View style={styles.planItemPopularBadge}>
                      <Text style={styles.planItemPopularText}>BEST VALUE</Text>
                    </View>
                  ) : null}

                  <View style={styles.planItemLeft}>
                    <Text style={styles.planItemName}>{plan.name}</Text>
                    <View style={styles.planItemPriceRow}>
                      <Text style={styles.planItemPrice}>₱{plan.pricePhp}</Text>
                      <Text style={styles.planItemCycle}>
                        /{plan.billingCycle === 'monthly' ? 'month' : plan.billingCycle === 'quarterly' ? '3 months' : plan.billingCycle === 'semiannual' ? '6 months' : 'year'}
                      </Text>
                    </View>
                    {plan.discountLabel && (
                      <Text style={styles.planItemDiscount}>{plan.discountLabel}</Text>
                    )}
                  </View>
                  <View style={styles.planItemRight}>
                    <ChevronRight size={20} color={COLORS.textTertiary} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Safety & Downgrade Reassurance */}
          <View style={styles.reassuranceCard}>
            <ShieldCheck size={20} color={COLORS.primary} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.reassuranceTitle}>Data Safety Guarantee</Text>
              <Text style={styles.reassuranceDesc}>
                Your products, photos, and sales history remain safe and accessible even if your subscription expires.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* CHECKOUT MODAL */}
      <Modal
        visible={!!selectedPlanForCheckout}
        transparent
        animationType="slide"
        onRequestClose={handleCloseCheckout}
      >
        <KeyboardAvoidingViewComponent
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Backdrop tap dismisses keyboard if open, preserving entered form data */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={Keyboard.dismiss}
            accessible={false}
          />

          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <CreditCard size={18} color={COLORS.primary} />
                <Text style={styles.modalTitle}>
                  Payment Details
                </Text>
              </View>
              <View style={styles.modalHeaderActions}>
                {isKeyboardOpen && (
                  <TouchableOpacity
                    onPress={Keyboard.dismiss}
                    style={styles.keyboardDoneChip}
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss keyboard"
                  >
                    <Text style={styles.keyboardDoneChipText}>Done</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={handleCloseCheckout}
                  style={styles.modalCloseBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Close payment details"
                >
                  <X size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <Pressable onPress={Keyboard.dismiss} accessible={false}>
                {/* Payment Method Selector */}
                <View style={styles.testCardSection}>
                  <Text style={styles.testCardSectionLabel}>SELECT CARD</Text>
                  <View style={styles.testCardChipsRow}>
                    {TEST_CARDS.map((tc) => (
                      <TouchableOpacity
                        key={tc.label}
                        style={styles.testCardChip}
                        onPress={() => handleSelectCard(tc)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.testCardChipText}>{tc.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Form Error */}
                {formError && (
                  <View style={styles.modalErrorBox}>
                    <AlertCircle size={15} color="#DC2626" />
                    <Text style={styles.modalErrorText}>{formError}</Text>
                  </View>
                )}

                {/* Form Inputs */}
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Cardholder Name</Text>
                  <TextInput
                    style={styles.textInput}
                    value={cardDetails.cardholderName}
                    onChangeText={(text) => setCardDetails((prev) => ({ ...prev, cardholderName: text }))}
                    placeholder="Juan Dela Cruz"
                    placeholderTextColor={COLORS.textTertiary}
                    autoCapitalize="words"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => cardNumberInputRef.current?.focus()}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Card Number</Text>
                  <TextInput
                    ref={cardNumberInputRef}
                    style={[styles.textInput, styles.fontMono]}
                    value={cardDetails.cardNumber}
                    onChangeText={handleFormatCardNumber}
                    keyboardType="numeric"
                    maxLength={19}
                    placeholder="4242 4242 4242 4242"
                    placeholderTextColor={COLORS.textTertiary}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => expiryInputRef.current?.focus()}
                  />
                </View>

                <View style={styles.formRow}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Expiration Date</Text>
                    <TextInput
                      ref={expiryInputRef}
                      style={[styles.textInput, styles.fontMono]}
                      value={cardDetails.expiryDate}
                      onChangeText={handleFormatExpiry}
                      keyboardType="numeric"
                      maxLength={5}
                      placeholder="MM/YY"
                      placeholderTextColor={COLORS.textTertiary}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => cvvInputRef.current?.focus()}
                    />
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>CVV</Text>
                    <TextInput
                      ref={cvvInputRef}
                      style={[styles.textInput, styles.fontMono]}
                      value={cardDetails.cvv}
                      onChangeText={(text) => setCardDetails((prev) => ({ ...prev, cvv: text.slice(0, 4) }))}
                      keyboardType="numeric"
                      secureTextEntry
                      maxLength={4}
                      placeholder="CVV"
                      placeholderTextColor={COLORS.textTertiary}
                      returnKeyType="done"
                      blurOnSubmit={true}
                      onSubmitEditing={Keyboard.dismiss}
                    />
                  </View>
                </View>

                {/* Pricing Summary */}
                {selectedPlanForCheckout && (
                  <View style={styles.orderSummaryBox}>
                    <View style={styles.orderSummaryRow}>
                      <Text style={styles.orderSummaryLabel}>Plan:</Text>
                      <Text style={styles.orderSummaryVal}>{selectedPlanForCheckout.name}</Text>
                    </View>
                    <View style={styles.orderSummaryRow}>
                      <Text style={styles.orderSummaryLabel}>Billing Period:</Text>
                      <Text style={styles.orderSummaryVal}>{selectedPlanForCheckout.durationDays} Days</Text>
                    </View>
                    <View style={styles.orderSummaryTotalRow}>
                      <Text style={styles.orderSummaryTotalLabel}>Total Amount:</Text>
                      <Text style={styles.orderSummaryTotalVal}>₱{selectedPlanForCheckout.pricePhp}.00</Text>
                    </View>
                  </View>
                )}

                {/* Action Buttons */}
                <View style={styles.modalActionsRow}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={handleCloseCheckout}
                    disabled={simulatingPayment}
                  >
                    <Text style={styles.modalCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalPayBtn, simulatingPayment && styles.btnDisabled]}
                    onPress={handleConfirmSubscription}
                    disabled={simulatingPayment}
                    activeOpacity={0.85}
                  >
                    {simulatingPayment ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.modalPayBtnText}>
                        Confirm Subscription
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingViewComponent>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.canvas,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  contentWrapper: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  header: {
    marginBottom: 16,
  },
  description: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#1B4D25',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 20,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusSectionLabel: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 0.6,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeTrial: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  statusBadgePremium: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusBadgeFree: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.text,
  },
  trialInfoBox: {
    backgroundColor: '#F3F9EE',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#D4ECC6',
  },
  trialInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  trialCountdown: {
    fontFamily: FONTS.extraBold,
    fontSize: 15,
    color: COLORS.primary,
  },
  trialExpiresText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  premiumInfoBox: {
    backgroundColor: '#F3F9EE',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#D4ECC6',
  },
  premiumPlanName: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.primary,
    marginBottom: 2,
  },
  premiumExpiresText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  premiumDaysRemaining: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 2,
    marginBottom: 8,
  },
  autoRenewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2F0D8',
    marginBottom: 8,
  },
  autoRenewStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  autoRenewStatusText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
  },
  premiumActionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  actionBtnRenew: {
    backgroundColor: COLORS.primary,
  },
  actionBtnRenewText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  actionBtnOutline: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECE3D2',
  },
  actionBtnOutlineText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.text,
  },
  actionBtnCancel: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  actionBtnCancelText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#DC2626',
  },
  freeInfoBox: {},
  freeLimitsTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 6,
  },
  freeLimitsText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 14,
  },
  activateTrialBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  activateTrialBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  plansHeaderRow: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: FONTS.extraBold,
    fontSize: 17,
    color: COLORS.text,
  },
  plansList: {
    gap: 12,
    marginBottom: 20,
  },
  planItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  planItemCardPopular: {
    borderColor: '#B9DF9D',
    backgroundColor: '#F8FCF5',
  },
  planItemCardActive: {
    borderColor: COLORS.primary,
    borderWidth: 2,
    backgroundColor: '#F8FCF5',
  },
  planItemPopularBadge: {
    position: 'absolute',
    top: -8,
    right: 14,
    backgroundColor: '#207429',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  planItemActiveBadge: {
    position: 'absolute',
    top: -8,
    right: 14,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  planItemPopularText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: '#FFFFFF',
  },
  planItemLeft: {
    flex: 1,
  },
  planItemName: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 4,
  },
  planItemPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  planItemPrice: {
    fontFamily: FONTS.extraBold,
    fontSize: 18,
    color: COLORS.primary,
  },
  planItemCycle: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 2,
  },
  planItemDiscount: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: '#D97706',
    marginTop: 4,
  },
  planItemRight: {
    paddingLeft: 12,
  },
  reassuranceCard: {
    backgroundColor: '#FAF7EE',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  reassuranceTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 4,
  },
  reassuranceDesc: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },

  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 14,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  keyboardDoneChip: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  keyboardDoneChipText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.primary,
  },
  modalTitle: {
    fontFamily: FONTS.extraBold,
    fontSize: 18,
    color: COLORS.text,
  },
  modalCloseBtn: {
    padding: 6,
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testCardSection: {
    marginBottom: 14,
  },
  testCardSectionLabel: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  testCardChipsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  testCardChip: {
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  testCardChipText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.text,
  },
  modalErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  modalErrorText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.dangerDark,
    flex: 1,
  },
  formGroup: {
    marginBottom: 12,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputLabel: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    minHeight: 48,
    fontSize: 15,
    color: COLORS.text,
    fontFamily: FONTS.regular,
  },
  fontMono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  orderSummaryBox: {
    backgroundColor: COLORS.canvas,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 4,
    marginBottom: 16,
    gap: 6,
  },
  orderSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderSummaryLabel: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  orderSummaryVal: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.text,
  },
  orderSummaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
    marginTop: 4,
  },
  orderSummaryTotalLabel: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.text,
  },
  orderSummaryTotalVal: {
    fontFamily: FONTS.extraBold,
    fontSize: 16,
    color: COLORS.primary,
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
  },
  modalCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  modalPayBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minHeight: 48,
    borderRadius: 12,
  },
  modalPayBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
