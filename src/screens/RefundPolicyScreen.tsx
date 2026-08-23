import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';

export default function RefundPolicyScreen() {
  const navigation = useNavigation();

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="pt-14 pb-4 px-6 bg-surface/90 border-b border-border/20 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="w-10 h-10 rounded-full bg-surface-inner items-center justify-center border border-border/30"
        >
          <MaterialIcons name="arrow-back" size={20} color={colors.text.DEFAULT} />
        </TouchableOpacity>
        <View className="items-center">
          <Text className="text-text font-headline text-base font-bold">Refund Policy</Text>
          <Text className="text-text-muted font-body text-[10px]">Somiq by Veriq Labs</Text>
        </View>
        <View className="w-10" />
      </View>

      <ScrollView
        className="flex-1 px-6 pt-6"
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-6 bg-primary/5 p-4 rounded-2xl border border-primary/20">
          <Text className="text-primary font-mono text-[10px] font-bold uppercase mb-1">PAYMENT PROTECTION</Text>
          <Text className="text-text font-headline text-lg font-bold">Refund & Cancellation</Text>
          <Text className="text-text-muted font-body text-xs mt-1">
            Last Updated: July 3, 2026. We strive to provide transparent, fair, and reliable billing terms.
          </Text>
        </View>

        {/* Section 1 */}
        <View className="mb-6 p-5 bg-surface/80 rounded-2xl border border-border/40">
          <Text className="text-primary font-mono text-xs font-bold mb-1">01. 7-DAY MONEY-BACK GUARANTEE</Text>
          <Text className="text-text font-headline text-base font-bold mb-2">First-Time Subscriber Guarantee</Text>
          <Text className="text-text-muted font-body text-xs leading-relaxed">
            We offer a 7-Day Money-Back Guarantee for first-time paid plan subscribers. If you are unsatisfied with Somiq, you can request a 100% full refund within 7 calendar days of your initial purchase.
          </Text>
          <View className="mt-3 p-3 bg-surface-inner rounded-xl border border-border/20">
            <Text className="text-text-muted font-body text-[11px]">
              • Eligibility Threshold: Eligible if you have consumed fewer than 5 verification credits since subscribing.
            </Text>
          </View>
        </View>

        {/* Section 2 */}
        <View className="mb-6 p-5 bg-surface/80 rounded-2xl border border-border/40">
          <Text className="text-primary font-mono text-xs font-bold mb-1">02. SUBSCRIPTION CANCELLATION</Text>
          <Text className="text-text font-headline text-base font-bold mb-2">Cancel Anytime</Text>
          <Text className="text-text-muted font-body text-xs leading-relaxed">
            You can manage or cancel your subscription anytime via Profile Settings. Upon cancellation, your subscription remains active until the end of your paid billing cycle.
          </Text>
        </View>

        {/* Section 3 */}
        <View className="mb-6 p-5 bg-surface/80 rounded-2xl border border-border/40">
          <Text className="text-primary font-mono text-xs font-bold mb-1">03. BILLING ERRORS & ANOMALIES</Text>
          <Text className="text-text font-headline text-base font-bold mb-2">100% Billing Error Protection</Text>
          <Text className="text-text-muted font-body text-xs leading-relaxed">
            We guarantee a 100% full refund for duplicate charges or technical gateway errors where a transaction occurs without tier activation.
          </Text>
        </View>

        {/* Section 4 */}
        <View className="mb-6 p-5 bg-surface/80 rounded-2xl border border-border/40">
          <Text className="text-primary font-mono text-xs font-bold mb-1">04. SYSTEM FAILURE CREDIT RETURN</Text>
          <Text className="text-text font-headline text-base font-bold mb-2">Automatic Credit Reversals</Text>
          <Text className="text-text-muted font-body text-xs leading-relaxed">
            If a claim check fails due to internal AI pipeline errors or system outages, consumed audit credits are automatically returned to your account balance.
          </Text>
        </View>

        {/* Section 5 */}
        <View className="mb-6 p-5 bg-surface/80 rounded-2xl border border-border/40">
          <Text className="text-primary font-mono text-xs font-bold mb-1">05. PROCESSING & REVERSAL TIMES</Text>
          <Text className="text-text font-headline text-base font-bold mb-2">5-7 Business Days</Text>
          <Text className="text-text-muted font-body text-xs leading-relaxed">
            Approved refunds are returned directly to the original payment method (card, UPI, or PayPal) within 5 to 7 business days depending on bank settlement schedules.
          </Text>
        </View>

        {/* Section 6 */}
        <View className="mb-8 p-5 bg-surface/80 rounded-2xl border border-border/40">
          <Text className="text-primary font-mono text-xs font-bold mb-1">06. SUBMIT REFUND REQUEST</Text>
          <Text className="text-text font-headline text-base font-bold mb-2">Contact Billing Support</Text>
          <Text className="text-text-muted font-body text-xs leading-relaxed">
            To submit a refund or billing request, contact support@veriqlabs.com with your account email and transaction ID.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
