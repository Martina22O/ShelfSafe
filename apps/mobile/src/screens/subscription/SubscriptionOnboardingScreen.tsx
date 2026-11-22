/**
 * Screen: SubscriptionOnboardingScreen
 * Displays after first sign-in for newly registered accounts.
 * Background: apps/mobile/assets/designs/mobile-bg.png (consistent with auth screens)
 * Features:
 * - 30-Day Free Trial value highlights (unlimited inventory, photos, analytics)
 * - 4 available subscription plans preview
 * - Primary Action: "Start 30-Day Free Trial" (no payment method required)
 * - Secondary Action: "Continue with Free / Skip for Now" (preserves trial eligibility)
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Image,
  Dimensions,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  Sparkles,
  CheckCircle2,
  Package,
  Camera,
  TrendingUp,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react-native';
import { COLORS, FONTS } from '../../theme';
import {
  startFreeTrial,
  completeSubscriptionOnboarding,
  SUBSCRIPTION_PLANS,
} from '../../services/subscription';

interface Props {
  onComplete: () => void;
}

export default function SubscriptionOnboardingScreen({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  // Proportional scaling for mobile-bg.png (1708x3684, aspect ratio 1842/854)
  const bgHeight = Math.round(screenWidth * (1842 / 854));
  const cardTopMargin = Math.max(Math.round(bgHeight * 0.32), insets.top + 160);

  const [loadingTrial, setLoadingTrial] = useState(false);
  const [loadingSkip, setLoadingSkip] = useState(false);
  const isBusy = loadingTrial || loadingSkip;

  const handleStartTrial = async () => {
    if (isBusy) return;
    setLoadingTrial(true);

    try {
      const result = await startFreeTrial();

      if (result.isRpcUnavailable) {
        Alert.alert(
          'Preview Access Active',
          'Subscription migrations are currently local. You are proceeding with full preview access.',
          [{ text: 'Continue', onPress: onComplete }]
        );
        return;
      }

      if (!result.success) {
        Alert.alert('Notice', result.error || 'Could not activate trial.', [
          { text: 'OK', onPress: onComplete },
        ]);
        return;
      }

      // Success
      Alert.alert(
        '30-Day Trial Activated!',
        'Welcome to ShelfSafe Premium! Enjoy unlimited products, photos, and full analytics for 30 days.',
        [{ text: 'Get Started', onPress: onComplete }]
      );
    } catch (err: any) {
      Alert.alert('Notice', err?.message || 'Unexpected error occurred.', [
        { text: 'OK', onPress: onComplete },
      ]);
    } finally {
      setLoadingTrial(false);
    }
  };

  const handleSkip = async () => {
    if (isBusy) return;
    setLoadingSkip(true);

    try {
      await completeSubscriptionOnboarding('skip');
    } catch {
      // Ignore network errors on skip
    } finally {
      setLoadingSkip(false);
      onComplete();
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.movingLayer, { minHeight: Math.max(screenHeight, bgHeight) }]}>
          {/* Proportional background artwork */}
          <Image
            source={require('../../../assets/designs/mobile-bg.png')}
            style={[styles.bgImage, { width: screenWidth, height: bgHeight }]}
            resizeMode="contain"
            pointerEvents="none"
          />

          {/* Floating content card */}
          <View
            style={[
              styles.cardOuterWrapper,
              {
                paddingTop: cardTopMargin,
                paddingBottom: Math.max(insets.bottom, 16) + 32,
              },
            ]}
          >
            <View style={styles.card}>
              {/* Header Badge */}
              <View style={styles.badgeRow}>
                <View style={styles.trialBadge}>
                  <Sparkles size={14} color="#185E21" />
                  <Text style={styles.trialBadgeText}>30-DAY FREE TRIAL</Text>
                </View>
              </View>

              {/* Title & Subtitle */}
              <Text style={styles.title}>Unlock ShelfSafe Premium</Text>
              <Text style={styles.subtitle}>
                Start your 30-day free trial today. Experience the full power of ShelfSafe with zero commitment.
              </Text>

              {/* Feature Highlights */}
              <View style={styles.featuresContainer}>
                <View style={styles.featureItem}>
                  <View style={styles.featureIconWrap}>
                    <Package size={18} color={COLORS.primary} />
                  </View>
                  <View style={styles.featureTextWrap}>
                    <Text style={styles.featureTitle}>Unlimited Products</Text>
                    <Text style={styles.featureDesc}>Free is capped at 20 products. Premium has no limit.</Text>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <View style={styles.featureIconWrap}>
                    <Camera size={18} color={COLORS.primary} />
                  </View>
                  <View style={styles.featureTextWrap}>
                    <Text style={styles.featureTitle}>Unlimited Product Photos</Text>
                    <Text style={styles.featureDesc}>Free is capped at 5 photos. Upload photos for your full catalog.</Text>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <View style={styles.featureIconWrap}>
                    <TrendingUp size={18} color={COLORS.primary} />
                  </View>
                  <View style={styles.featureTextWrap}>
                    <Text style={styles.featureTitle}>Full Sales History & Analytics</Text>
                    <Text style={styles.featureDesc}>Track lifetime trends beyond the standard 7-day limit.</Text>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <View style={styles.featureIconWrap}>
                    <ShieldCheck size={18} color={COLORS.primary} />
                  </View>
                  <View style={styles.featureTextWrap}>
                    <Text style={styles.featureTitle}>Safe Inventory Protection</Text>
                    <Text style={styles.featureDesc}>Your data is never deleted if you ever return to Free.</Text>
                  </View>
                </View>
              </View>

              {/* Plan Pricing Grid */}
              <View style={styles.plansSection}>
                <Text style={styles.plansHeader}>Future Subscription Options</Text>
                <Text style={styles.plansSubHeader}>Choose a plan when your trial completes or stay on Free</Text>

                <View style={styles.plansGrid}>
                  {SUBSCRIPTION_PLANS.map((plan) => (
                    <View
                      key={plan.id}
                      style={[
                        styles.planCard,
                        plan.isPopular && styles.planCardPopular,
                      ]}
                    >
                      {plan.isPopular && (
                        <View style={styles.popularBadge}>
                          <Text style={styles.popularBadgeText}>BEST VALUE</Text>
                        </View>
                      )}
                      <Text style={styles.planName}>{plan.name.replace(' Premium', '')}</Text>
                      <View style={styles.priceRow}>
                        <Text style={styles.priceAmount}>₱{plan.pricePhp}</Text>
                        <Text style={styles.priceCycle}>
                          /{plan.billingCycle === 'monthly' ? 'mo' : plan.billingCycle === 'quarterly' ? '3 mos' : plan.billingCycle === 'semiannual' ? '6 mos' : 'yr'}
                        </Text>
                      </View>
                      {plan.discountLabel ? (
                        <Text style={styles.discountLabel}>{plan.discountLabel}</Text>
                      ) : (
                        <Text style={styles.discountLabelPlaceholder}>Standard rate</Text>
                      )}
                    </View>
                  ))}
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionsContainer}>
                {/* Primary CTA */}
                <TouchableOpacity
                  style={[styles.primaryBtn, isBusy && styles.btnDisabled]}
                  onPress={handleStartTrial}
                  disabled={isBusy}
                  activeOpacity={0.88}
                >
                  {loadingTrial ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Sparkles size={18} color="#FFFFFF" />
                      <Text style={styles.primaryBtnText}>Start 30-Day Free Trial</Text>
                      <ArrowRight size={18} color="#FFFFFF" />
                    </>
                  )}
                </TouchableOpacity>

                {/* Secondary CTA */}
                <TouchableOpacity
                  style={[styles.secondaryBtn, isBusy && styles.btnDisabled]}
                  onPress={handleSkip}
                  disabled={isBusy}
                  activeOpacity={0.7}
                >
                  {loadingSkip ? (
                    <ActivityIndicator size="small" color={COLORS.textSecondary} />
                  ) : (
                    <Text style={styles.secondaryBtnText}>Continue with Free / Skip for Now</Text>
                  )}
                </TouchableOpacity>

                {/* Reassurance Note */}
                <Text style={styles.reassuranceText}>
                  No credit card required. Cancel anytime or continue on the Free plan after 30 days.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FEF7E6',
  },
  scrollContent: {
    flexGrow: 1,
  },
  movingLayer: {
    position: 'relative',
    width: '100%',
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  cardOuterWrapper: {
    paddingHorizontal: 20,
    width: '100%',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#EFE7DA',
    shadowColor: '#1B4D25',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  trialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C8E6C9',
    gap: 6,
  },
  trialBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: '#185E21',
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: FONTS.extraBold,
    fontSize: 24,
    color: COLORS.text,
    lineHeight: 30,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  featuresContainer: {
    backgroundColor: '#FAF7EE',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFE7DA',
    gap: 14,
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  featureIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E6E0D2',
  },
  featureTextWrap: {
    flex: 1,
  },
  featureTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 20,
  },
  featureDesc: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginTop: 2,
  },
  plansSection: {
    marginBottom: 22,
  },
  plansHeader: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 2,
  },
  plansSubHeader: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  plansGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  planCard: {
    width: '48%',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EAE6DC',
    position: 'relative',
  },
  planCardPopular: {
    backgroundColor: '#F3F9EE',
    borderColor: '#B9DF9D',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    right: 8,
    backgroundColor: '#207429',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  popularBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: '#FFFFFF',
  },
  planName: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.text,
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceAmount: {
    fontFamily: FONTS.extraBold,
    fontSize: 18,
    color: COLORS.primary,
  },
  priceCycle: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textSecondary,
    marginLeft: 2,
  },
  discountLabel: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: '#D97706',
    marginTop: 4,
  },
  discountLabelPlaceholder: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.textTertiary,
    marginTop: 4,
  },
  actionsContainer: {
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  secondaryBtn: {
    paddingVertical: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  reassuranceText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
  },
});
