import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Button } from '@/components/Button';
import { useColorScheme } from 'nativewind';
import { colors } from '@/theme/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { useToast } from '@/hooks/useToast';
import { billingApi } from '@/services/api.service';
import { authService } from '@/services/auth.service';
import { useNavigation } from '@react-navigation/native';
import RazorpayCheckout from 'react-native-razorpay';
import * as WebBrowser from 'expo-web-browser';

type Interval = 'month' | '3months' | '6months' | 'year';

interface PlanPricing {
  monthlyEquivalent: string;
  monthlyOriginal?: string;
  totalBilled: string;
  totalBilledOriginal?: string;
  savings?: string;
}

interface PricingPlan {
  id: 'free' | 'premium' | 'pro';
  name: string;
  color: string;
  badge?: string;
  pricing: {
    USD: Record<Interval, PlanPricing>;
    INR: Record<Interval, PlanPricing>;
  };
  features: string[];
}

const isIndiaRegion = () => {
  try {
    const locales = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().locale : '';
    if (locales && (locales.includes('-IN') || locales.includes('en-IN') || locales.includes('hi-IN'))) {
      return true;
    }
    const timezone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : '';
    if (timezone && (timezone.includes('Calcutta') || timezone.includes('Kolkata') || timezone.includes('Asia/Kolkata'))) {
      return true;
    }
  } catch (e) {
    console.log('[Locale] Error detecting region:', e);
  }
  return false;
};

const BASE_PRICES: Record<'free' | 'premium' | 'pro', Record<Interval, number>> = {
  free: { month: 0, '3months': 0, '6months': 0, year: 0 },
  premium: { month: 0.99, '3months': 2.49, '6months': 4.49, year: 7.99 },
  pro: { month: 4.79, '3months': 13.19, '6months': 23.99, year: 43.19 },
};

const BASE_ORIGINAL_PRICES: Record<'free' | 'premium' | 'pro', Record<Interval, number | undefined>> = {
  free: { month: undefined, '3months': undefined, '6months': undefined, year: undefined },
  premium: { month: 1.79, '3months': 4.79, '6months': 8.99, year: 15.59 },
  pro: { month: 5.99, '3months': 16.79, '6months': 31.19, year: 56.39 },
};

export default function PaywallScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { showToast } = useToast();
  const navigation = useNavigation();
  const [selectedInterval, setSelectedInterval] = useState<Interval>('month');
  const [currency, setCurrency] = useState<'USD' | 'INR'>(isIndiaRegion() ? 'INR' : 'USD');
  const [userSession, setUserSession] = useState<{ email: string; name: string; tier: string } | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number>(83.5); // fallback rate
  const [loadingRate, setLoadingRate] = useState<boolean>(true);

  useEffect(() => {
    async function fetchExchangeRate() {
      try {
        const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=INR');
        const data = await res.json();
        if (data && data.rates && data.rates.INR) {
          setExchangeRate(data.rates.INR);
          console.info(`[PaywallScreen] Dynamic exchange rate loaded: ${data.rates.INR}`);
        }
      } catch (err) {
        console.error('[PaywallScreen] Failed to fetch dynamic exchange rate, using fallback:', err);
      } finally {
        setLoadingRate(false);
      }
    }
    fetchExchangeRate();
  }, []);

  const getDynamicPrice = (usdAmount: number, isINR: boolean) => {
    if (usdAmount === 0) return isINR ? '₹0' : '$0';
    if (!isINR) return `$${usdAmount.toFixed(2).replace('.00', '')}`;
    const inrAmount = Math.round(usdAmount * exchangeRate);
    return `₹${inrAmount.toLocaleString('en-IN')}`;
  };

  const getMonthlyEquivalent = (totalUsd: number, months: number, isINR: boolean) => {
    if (totalUsd === 0) return isINR ? '₹0' : '$0';
    const monthlyUsd = totalUsd / months;
    if (!isINR) return `$${monthlyUsd.toFixed(2)}`;
    const monthlyInr = Math.round(monthlyUsd * exchangeRate);
    return `₹${monthlyInr.toLocaleString('en-IN')}`;
  };

  const getPlanPricing = (planId: 'free' | 'premium' | 'pro', interval: Interval, curr: 'USD' | 'INR'): PlanPricing => {
    const usdPrice = BASE_PRICES[planId][interval];
    const usdOriginal = BASE_ORIGINAL_PRICES[planId][interval];
    const months = interval === 'month' ? 1 : interval === '3months' ? 3 : interval === '6months' ? 6 : 12;
    const isINR = curr === 'INR';

    let savings = undefined;
    if (planId === 'premium') {
      if (interval === '3months') savings = 'Save 48%';
      if (interval === '6months') savings = 'Save 50%';
      if (interval === 'year') savings = 'Save 48%';
    } else if (planId === 'pro') {
      if (interval === '3months') savings = 'Save 21%';
      if (interval === '6months') savings = 'Save 23%';
      if (interval === 'year') savings = 'Save 23%';
    }

    return {
      monthlyEquivalent: getMonthlyEquivalent(usdPrice, months, isINR),
      monthlyOriginal: usdOriginal ? getMonthlyEquivalent(usdOriginal, months, isINR) : undefined,
      totalBilled: getDynamicPrice(usdPrice, isINR),
      totalBilledOriginal: usdOriginal ? getDynamicPrice(usdOriginal, isINR) : undefined,
      savings,
    };
  };

  const plans: PricingPlan[] = [
    {
      id: 'free',
      name: 'Free',
      color: colors.primary,
      pricing: {
        USD: {
          month: getPlanPricing('free', 'month', 'USD'),
          '3months': getPlanPricing('free', '3months', 'USD'),
          '6months': getPlanPricing('free', '6months', 'USD'),
          year: getPlanPricing('free', 'year', 'USD'),
        },
        INR: {
          month: getPlanPricing('free', 'month', 'INR'),
          '3months': getPlanPricing('free', '3months', 'INR'),
          '6months': getPlanPricing('free', '6months', 'INR'),
          year: getPlanPricing('free', 'year', 'INR'),
        },
      },
      features: [
        '5 verifications per month limit',
        'Maximum 2 verifications per day',
        'Extracts up to 3 factual claims per check',
        'YouTube Shorts & Instagram Reels only',
        'Standard processing queue priority',
        'English output logs only',
        'Standard AI verification pipeline',
      ],
    },
    {
      id: 'premium',
      name: 'Premium',
      color: colors.gold,
      badge: 'RECOMMENDED',
      pricing: {
        USD: {
          month: getPlanPricing('premium', 'month', 'USD'),
          '3months': getPlanPricing('premium', '3months', 'USD'),
          '6months': getPlanPricing('premium', '6months', 'USD'),
          year: getPlanPricing('premium', 'year', 'USD'),
        },
        INR: {
          month: getPlanPricing('premium', 'month', 'INR'),
          '3months': getPlanPricing('premium', '3months', 'INR'),
          '6months': getPlanPricing('premium', '6months', 'INR'),
          year: getPlanPricing('premium', 'year', 'INR'),
        },
      },
      features: [
        '50 verifications per month limit',
        'Maximum 8 verifications per day limit',
        'Extracts up to 5 factual claims per check',
        'Enhanced AI reasoning pipeline',
        'Fast processing queue (Faster speed)',
        'YouTube, Instagram Reels & TikTok support',
        'Max 3-minute local uploads (videos/images)',
        'English translation + Original audio toggle',
        'Priority email customer support',
      ],
    },
    {
      id: 'pro',
      name: 'Pro',
      color: colors.tertiary,
      badge: 'POWER USER',
      pricing: {
        USD: {
          month: getPlanPricing('pro', 'month', 'USD'),
          '3months': getPlanPricing('pro', '3months', 'USD'),
          '6months': getPlanPricing('pro', '6months', 'USD'),
          year: getPlanPricing('pro', 'year', 'USD'),
        },
        INR: {
          month: getPlanPricing('pro', 'month', 'INR'),
          '3months': getPlanPricing('pro', '3months', 'INR'),
          '6months': getPlanPricing('pro', '6months', 'INR'),
          year: getPlanPricing('pro', 'year', 'INR'),
        },
      },
      features: [
        'Up to 250 verifications per month',
        'Extracts up to 10 factual claims per check',
        'Fair-use daily protection (Anti-abuse)',
        'Deepest AI reasoning and verification',
        'Instant processing queue (Dedicated workers)',
        'YouTube, Instagram Reels & TikTok support',
        'Max 3-minute local uploads (videos/images)',
        'Full multilingual dual translation viewing',
        'PDF reports generation & exports',
        'Manual Revision Requests (Dispute review)',
        'Premium support (Fast SLA response)',
      ],
    },
  ];

  const isButtonDisabled = (planId: 'free' | 'premium' | 'pro') => {
    if (!userSession) return true; // Disable until session loads
    const currentTier = userSession.tier.toLowerCase() as 'free' | 'premium' | 'pro';

    if (currentTier === 'pro') {
      return true; // All buttons disabled if Pro
    }
    if (currentTier === 'premium') {
      // Free and Premium are disabled. Pro is enabled for upgrade.
      return planId === 'free' || planId === 'premium';
    }
    if (currentTier === 'free') {
      // Free is disabled. Premium and Pro are enabled for upgrade.
      return planId === 'free';
    }
    return false;
  };

  const getButtonLabel = (plan: PricingPlan) => {
    if (!userSession) return 'Loading...';
    const currentTier = userSession.tier.toLowerCase() as 'free' | 'premium' | 'pro';
    const planId = plan.id;

    if (currentTier === planId) {
      return planId === 'free' ? 'Current Tier' : 'Active Plan';
    }
    if (currentTier === 'pro') {
      return 'Included in Pro';
    }
    if (currentTier === 'premium' && planId === 'free') {
      return 'Included in Premium';
    }
    return `Subscribe ${plan.name}`;
  };

  useEffect(() => {
    async function loadUserSession() {
      try {
        const user = await authService.getUser();
        let activeTier = user?.tier || 'FREE';
        
        // Render local storage tier state immediately
        setUserSession({
          email: user?.email || '',
          name: user?.name || user?.email?.split('@')[0] || '',
          tier: activeTier,
        });

        try {
          const billingRes = await billingApi.getStatus();
          if (billingRes.data && billingRes.data.tier) {
            const freshTier = billingRes.data.tier;
            activeTier = freshTier;
            
            setUserSession({
              email: user?.email || '',
              name: user?.name || user?.email?.split('@')[0] || '',
              tier: freshTier,
            });

            // Sync fresh tier back to local user session if changed
            if (user && user.tier !== freshTier) {
              const currentToken = await authService.getToken();
              if (currentToken) {
                await authService.saveSession({
                  token: currentToken,
                  user: { ...user, tier: freshTier },
                  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                });
              }
            }
          }
        } catch (err) {
          console.log('[PaywallScreen] Error getting billing status:', err);
        }
      } catch (err) {
        console.log('[PaywallScreen] Error loading session:', err);
      }
    }
    loadUserSession();
  }, []);

  const intervals: { id: Interval; label: string; subLabel: string }[] = [
    { id: 'month', label: 'Monthly', subLabel: 'Standard' },
    { id: '3months', label: '3 Months', subLabel: 'Save up to 11%' },
    { id: '6months', label: '6 Months', subLabel: 'Save up to 16%' },
    { id: 'year', label: 'Annual', subLabel: 'Save up to 27%' },
  ];



  const handlePurchase = async (plan: PricingPlan) => {
    if (isButtonDisabled(plan.id)) {
      return;
    }

    if (plan.id === 'free') {
      showToast({
        title: 'Plan Info',
        message: 'You are currently on the Free Plan.',
        type: 'info',
      });
      return;
    }

    if (userSession?.tier === plan.id.toUpperCase()) {
      showToast({
        title: 'Active Subscription',
        message: `You are already subscribed to the ${plan.name} plan.`,
        type: 'info',
      });
      return;
    }

    setLoadingPlan(plan.id);
    try {
      if (currency === 'USD') {
        showToast({
          title: 'Opening Polar Checkout',
          message: 'Redirecting to secure gateway...',
          type: 'info',
        });

        const checkoutRes = await billingApi.createCheckout(
          plan.id.toUpperCase() as 'PREMIUM' | 'PRO',
          selectedInterval,
          'POLAR',
          'somiq://pricing?success=true'
        );

        const checkoutUrl = checkoutRes.data.checkoutUrl;
        if (checkoutUrl) {
          // Open secure payment sheet overlay and await user completion/deep link redirect
          await WebBrowser.openAuthSessionAsync(checkoutUrl, 'somiq://');

          showToast({
            title: 'Payment Processed',
            message: 'Verifying your subscription status...',
            type: 'info',
          });

          // Poll with increasing delays to catch the Polar webhook after it fires.
          // Polar webhooks typically arrive within 5–15 seconds of payment.
          const POLL_DELAYS_MS = [2000, 4000, 6000, 10000, 15000];
          let upgraded = false;

          const pollBillingStatus = async (): Promise<void> => {
            try {
              const billingRes = await billingApi.getStatus();
              const newTier = billingRes.data?.tier;
              if (newTier && newTier !== 'FREE') {
                setUserSession((prev) => (prev ? { ...prev, tier: newTier } : null));
                if (!upgraded) {
                  upgraded = true;
                  showToast({
                    title: '🎉 Subscription Activated!',
                    message: `You are now on the ${newTier} plan. Enjoy Somiq!`,
                    type: 'success',
                  });
                }
              }
            } catch (refreshErr) {
              console.log('[Paywall] Failed to refresh billing status post-checkout:', refreshErr);
            }
          };

          // Kick off all polls — each fires independently after its delay.
          // If the webhook is fast (2–4 s) the first poll catches it;
          // later polls serve as safety nets for slower deliveries.
          await pollBillingStatus(); // immediate check
          POLL_DELAYS_MS.forEach((delay) => setTimeout(pollBillingStatus, delay));
        } else {
          throw new Error('No checkout URL returned from Polar');
        }
        return;
      }

      showToast({
        title: 'Initializing Checkout',
        message: `Preparing secure Razorpay Gateway for ${plan.name}...`,
        type: 'info',
      });

      // 1. Call backend to create Order / Subscription
      const checkoutRes = await billingApi.createCheckout(
        plan.id.toUpperCase() as 'PREMIUM' | 'PRO',
        selectedInterval,
        'RAZORPAY'
      );

      // 2. Configure Razorpay Standard checkout parameters
      const options = {
        description: `Somiq ${plan.name} Sub (${selectedInterval})`,
        image: 'https://ik.imagekit.io/v6xwevpjp/Veriq/Somiq/somiq-no-bg-logo.png?tr=w-512,q-80,f-png',
        currency: 'INR',
        key: checkoutRes.data.keyId,
        subscription_id: checkoutRes.data.subscriptionId,
        name: 'Somiq',
        prefill: {
          email: userSession?.email || '',
          name: userSession?.name || '',
        },
        theme: {
          color: colors.primary,
        },
      };

      // 3. Open Razorpay Checkout modal
      RazorpayCheckout.open(options)
        .then(async (data: any) => {
          showToast({
            title: 'Payment Received',
            message: 'Verifying payment signature securely...',
            type: 'info',
          });

          // 4. Verify payment signature on the backend
          // Plan/tier is derived server-side from Razorpay — we just send the IDs.
          const verifyRes = await billingApi.verifyPayment(
            data.razorpay_payment_id,
            data.razorpay_subscription_id,
            data.razorpay_signature
          );

          const grantedTier = verifyRes.data?.tier ?? plan.id.toUpperCase();

          showToast({
            title: 'Upgrade Successful',
            message: verifyRes.data?.message ?? `Welcome to ${plan.name}! Your account has been upgraded.`,
            type: 'success',
          });

          // Update session with the server-confirmed tier
          setUserSession((prev) => (prev ? { ...prev, tier: grantedTier } : null));
          navigation.goBack();
        })
        .catch((error: any) => {
          console.log('[Paywall] Razorpay error:', error);
          let userFriendlyMsg = 'Checkout was dismissed by user.';
          
          if (error) {
            if (typeof error === 'string') {
              try {
                const parsed = JSON.parse(error);
                userFriendlyMsg = parsed.description || parsed.message || userFriendlyMsg;
              } catch (e) {
                userFriendlyMsg = error;
              }
            } else if (typeof error === 'object') {
              userFriendlyMsg = error.description || error.message || JSON.stringify(error);
            }
          }

          if (userFriendlyMsg.includes('{') || userFriendlyMsg.includes('"code"')) {
          
            userFriendlyMsg = 'Payment was cancelled or dismissed.';
          }

          showToast({
            title: 'Payment Cancelled',
            message: userFriendlyMsg,
            type: 'error',
          });
        });
    } catch (err: any) {
      console.log('[Paywall] Checkout exception:', err);
      const isAlreadySubscribed = err?.response?.data?.error === 'ALREADY_SUBSCRIBED';
      const serverMessage = err?.response?.data?.message || err?.message;

      if (isAlreadySubscribed) {
        showToast({
          title: 'Already Subscribed',
          message: 'You already have an active subscription. Syncing status...',
          type: 'info',
        });

        try {
          const billingRes = await billingApi.getStatus();
          if (billingRes.data && billingRes.data.tier) {
            setUserSession((prev) => (prev ? { ...prev, tier: billingRes.data.tier } : null));
          }
        } catch (refreshErr) {
          console.log('[Paywall] Failed to refresh session status:', refreshErr);
        }
      } else {
        let userMessage = 'Could not connect to billing server. Please check your connection and try again.';
        if (serverMessage) {
          if (serverMessage.includes('invalid_token') || serverMessage.includes('invalid_key')) {
            userMessage = 'The billing provider is currently undergoing maintenance. Please contact support.';
          } else if (serverMessage.includes('already exists')) {
            userMessage = 'This email account is already registered. Please login or use a different account.';
          } else {
            userMessage = serverMessage;
          }
        }
        showToast({
          title: 'Checkout Failed',
          message: userMessage,
          type: 'error',
        });
      }
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}
      className="bg-background px-5 pt-14"
      showsVerticalScrollIndicator={false}
    >
      {/* Close / Back Button */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        className="w-10 h-10 rounded-full bg-surface border border-border/20 items-center justify-center mb-4"
        activeOpacity={0.7}
      >
        <MaterialIcons name="close" size={20} color={colors.text.muted} />
      </TouchableOpacity>

      {/* Title Header */}
      <View className="items-center mb-6">
        <Text className="text-text font-headline text-2xl font-bold text-center">
          Choose Your Plan
        </Text>
        <Text className="text-text-muted font-body text-xs text-center mt-2 leading-relaxed max-w-[280px]">
          Verifications run a multi-stage pipeline: transcription, claim extraction, and deep AI reasoning.
        </Text>
      </View>

      {/* Currency Switcher */}
      <View className="flex-row justify-center items-center mb-6" style={{ gap: 8 }}>
        <TouchableOpacity
          onPress={() => setCurrency('USD')}
          className={`px-4 py-2 rounded-full border ${
            currency === 'USD'
              ? 'bg-primary border-primary'
              : 'bg-surface border-border/20'
          }`}
          activeOpacity={0.8}
        >
          <Text className={`font-headline text-[11px] font-bold ${currency === 'USD' ? 'text-black' : 'text-text-muted'}`}>
            $ USD (Global)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setCurrency('INR')}
          className={`px-4 py-2 rounded-full border ${
            currency === 'INR'
              ? 'bg-primary border-primary'
              : 'bg-surface border-border/20'
          }`}
          activeOpacity={0.8}
        >
          <Text className={`font-headline text-[11px] font-bold ${currency === 'INR' ? 'text-black' : 'text-text-muted'}`}>
            ₹ INR (India)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Pricing Interval Selector */}
      <View className="bg-surface-low p-1.5 rounded-3xl flex-row justify-between mb-8 border-2 border-border">
        {intervals.map((int) => {
          const isSelected = selectedInterval === int.id;
          return (
            <TouchableOpacity
              key={int.id}
              className={`flex-1 py-3 px-1 rounded-2xl items-center justify-center ${
                isSelected ? 'bg-primary shadow-md' : 'bg-transparent'
              }`}
              activeOpacity={0.8}
              onPress={() => setSelectedInterval(int.id)}
            >
              <Text
                className={`font-headline text-[11px] font-bold ${
                  isSelected ? 'text-black font-extrabold' : 'text-text-muted'
                }`}
              >
                {int.label}
              </Text>
              <Text
                className={`font-body text-[8px] mt-0.5 ${
                  isSelected ? 'text-black/70 font-semibold' : 'text-text-muted/60'
                }`}
              >
                {int.subLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Plans Vertical Cards Stack */}
      <View>
        {plans.map((plan) => {
          const pricing = plan.pricing[currency][selectedInterval];
          const isActive = userSession?.tier === plan.id.toUpperCase();
          const isFeatured = plan.id === 'premium';
          const isBtnDisabled = isButtonDisabled(plan.id);

          return (
            <View
              key={plan.id}
              className={`rounded-3xl p-6 border-2 relative overflow-hidden mb-6 ${
                isFeatured
                  ? 'border-gold bg-surface/80 shadow-xl'
                  : 'border-border bg-surface/40'
              }`}
            >
              {/* Badge Ribbon */}
              {plan.badge && (
                <View className="absolute top-4 right-4 bg-primary/10 border border-primary/20 px-3 py-1 rounded-full flex-row items-center" style={{ gap: 4 }}>
                  <MaterialIcons
                    name={plan.id === 'pro' ? 'star' : 'workspace-premium'}
                    size={9}
                    color={plan.id === 'pro' ? colors.gold : colors.primary}
                  />
                  <Text className="text-primary font-mono text-[8px] font-extrabold uppercase tracking-wider">
                    {plan.badge}
                  </Text>
                </View>
              )}

              {/* Tier Name */}
              <Text
                className="font-mono text-[11px] font-extrabold uppercase tracking-widest"
                style={{ color: plan.color }}
              >
                {plan.name} Tier
              </Text>

              {/* Price Details with Strikethrough for Launch Offer */}
              <View className="flex-row items-baseline mt-2.5 mb-1.5 flex-wrap" style={{ gap: 8 }}>
                {pricing.monthlyOriginal && (
                  <Text className="text-text-muted/40 line-through font-headline text-[22px] font-bold">
                    {pricing.monthlyOriginal}
                  </Text>
                )}
                <Text className="text-text font-headline text-3xl font-extrabold">
                  {pricing.monthlyEquivalent}
                </Text>
                <Text className="text-text-muted font-body text-xs">/month</Text>
                {plan.id !== 'free' && (
                  <View className="bg-primary/25 px-2 py-0.5 rounded-full border border-primary/40">
                    <Text className="text-primary font-mono text-[8px] font-extrabold uppercase tracking-wide">
                      LAUNCH OFFER
                    </Text>
                  </View>
                )}
              </View>

              {/* Total Billing Details & Savings */}
              {selectedInterval !== 'month' && plan.id !== 'free' && (
                <View className="flex-row items-center mb-4 flex-wrap" style={{ gap: 6 }}>
                  <View className="bg-success/10 px-2 py-0.5 rounded-md border border-success/20">
                    <Text className="text-success font-mono text-[9px] font-bold uppercase">
                      {pricing.savings}
                    </Text>
                  </View>
                  <Text className="text-text-muted font-body text-[10px]">
                    Billed as{' '}
                    <Text className="line-through">{pricing.totalBilledOriginal}</Text>{' '}
                    <Text className="font-bold text-text">{pricing.totalBilled}</Text> every{' '}
                    {selectedInterval === '3months'
                      ? '3 months'
                      : selectedInterval === '6months'
                      ? '6 months'
                      : 'year'}
                  </Text>
                </View>
              )}

              {selectedInterval === 'month' && plan.id !== 'free' && (
                <Text className="text-text-muted font-body text-[10px] mb-4">
                  Billed monthly. Cancel anytime.
                </Text>
              )}

              {plan.id === 'free' && (
                <Text className="text-text-muted font-body text-[10px] mb-4">
                  Free forever. No credit card required.
                </Text>
              )}

              {/* Features List */}
              <View className="border-t border-border/10 pt-4 mb-6">
                {plan.features.map((feature, idx) => {
                  const isThinking = feature.includes('AI Thinking');
                  return (
                    <View key={idx} className="flex-row items-start mb-3">
                      <MaterialIcons
                        name="check-circle"
                        size={15}
                        color={isThinking ? colors.secondary : plan.color}
                        style={{ marginRight: 9, marginTop: 1.5 }}
                      />
                      <Text
                        className={`font-body text-xs flex-1 ${
                          isThinking ? 'text-secondary font-bold' : 'text-text-muted'
                        }`}
                      >
                        {feature}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* Action Button */}
              <Button
                variant={isFeatured ? 'primary' : 'secondary'}
                onPress={() => handlePurchase(plan)}
                disabled={isBtnDisabled || loadingPlan !== null}
                loading={loadingPlan === plan.id}
                title={getButtonLabel(plan)}
                rightIcon={!isBtnDisabled && plan.id !== 'free' ? <MaterialIcons name="arrow-forward" size={14} color={isFeatured && isDark ? colors.background : colors.text.DEFAULT} /> : undefined}
                className="w-full"
              />
            </View>
          );
        })}
      </View>

      {/* Disclosures & Disclaimers */}
      <View className="mt-4 mb-8 px-2 border-t border-border/10 pt-6">
        <Text className="text-text-muted font-body text-[10px] leading-[15px] mb-2 font-bold">
          ℹ️ Merchant Notice: Somiq is a software product owned and operated by Veriq Labs. Subscription charges on your bank/card statement will display under Veriq Labs.
        </Text>
        <Text className="text-text-muted/60 font-body text-[10px] leading-[15px] mb-2">
          * Taxes may apply depending on your billing region and will be calculated automatically at checkout.
        </Text>
        <Text className="text-text-muted/60 font-body text-[10px] leading-[15px]">
          * All promotional plans renew automatically at the exact same recurring price shown above unless cancelled. You can easily manage or cancel your subscription at any time directly from your account profile settings to prevent future charges.
        </Text>
      </View>
    </ScrollView>
  );
}
