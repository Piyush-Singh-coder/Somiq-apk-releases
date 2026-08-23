import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';

export default function TermsOfServiceScreen() {
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
          <Text className="text-text font-headline text-base font-bold">Terms of Service</Text>
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
          <Text className="text-primary font-mono text-[10px] font-bold uppercase mb-1">LEGAL AGREEMENT</Text>
          <Text className="text-text font-headline text-lg font-bold">Terms & Conditions</Text>
          <Text className="text-text-muted font-body text-xs mt-1">
            Last Updated: June 16, 2026. Please read these terms carefully before using the Somiq mobile application.
          </Text>
        </View>

        {/* Section 1 */}
        <View className="mb-6 p-5 bg-surface/80 rounded-2xl border border-border/40">
          <Text className="text-primary font-mono text-xs font-bold mb-1">01. AGREEMENT TO TERMS</Text>
          <Text className="text-text font-headline text-base font-bold mb-2">Binding Contract</Text>
          <Text className="text-text-muted font-body text-xs leading-relaxed">
            These Terms constitute a legally binding agreement between you and Somiq (owned and operated by Veriq Labs). By installing or using the Mobile App, you agree to be bound by these terms. If you do not agree, you must uninstall the application immediately.
          </Text>
        </View>

        {/* Section 2 */}
        <View className="mb-6 p-5 bg-surface/80 rounded-2xl border border-border/40">
          <Text className="text-primary font-mono text-xs font-bold mb-1">02. ACCOUNTS & SECURITY</Text>
          <Text className="text-text font-headline text-base font-bold mb-2">Credential Responsibility</Text>
          <Text className="text-text-muted font-body text-xs leading-relaxed">
            You must provide accurate account information and keep your credentials confidential. You are responsible for all verification requests initiated under your account credentials.
          </Text>
        </View>

        {/* Section 3 */}
        <View className="mb-6 p-5 bg-surface/80 rounded-2xl border border-border/40">
          <Text className="text-primary font-mono text-xs font-bold mb-1">03. SUBSCRIPTIONS & RAZORPAY BILLING</Text>
          <Text className="text-text font-headline text-base font-bold mb-2">Tiers & Recurring Charges</Text>
          <Text className="text-text-muted font-body text-xs leading-relaxed">
            Somiq offers Free, Premium, and Pro subscription tiers with daily and monthly claim check limits. Paid subscriptions are billed on recurring cycles via Razorpay or Polar. All charges appear on bank statements as Veriq Labs.
          </Text>
        </View>

        {/* Section 4 */}
        <View className="mb-6 p-5 bg-surface/80 rounded-2xl border border-border/40">
          <Text className="text-primary font-mono text-xs font-bold mb-1">04. MOBILE AGENT & ON-DEVICE CPU</Text>
          <Text className="text-text font-headline text-base font-bold mb-2">Device Processing</Text>
          <Text className="text-text-muted font-body text-xs leading-relaxed">
            The App executes isolated audio processing on your device CPU/memory. You acknowledge that processing media consumes local battery power and data bandwidth. Somiq is not liable for carrier data overage charges.
          </Text>
        </View>

        {/* Section 5 */}
        <View className="mb-6 p-5 bg-surface/80 rounded-2xl border border-border/40">
          <Text className="text-primary font-mono text-xs font-bold mb-1">05. ACCEPTABLE USE RULES</Text>
          <Text className="text-text font-headline text-base font-bold mb-2">Prohibited Conduct</Text>
          <Text className="text-text-muted font-body text-xs leading-relaxed">
            You agree not to bypass quota limits, reverse engineer the App binary, use automated crawlers/bots against our API, or use AI verdicts to generate defamatory content.
          </Text>
        </View>

        {/* Section 6 */}
        <View className="mb-6 p-5 bg-surface/80 rounded-2xl border border-border/40">
          <Text className="text-primary font-mono text-xs font-bold mb-1">06. INTELLECTUAL PROPERTY</Text>
          <Text className="text-text font-headline text-base font-bold mb-2">Proprietary Technology</Text>
          <Text className="text-text-muted font-body text-xs leading-relaxed">
            All rights, source code, design assets, and AI evaluation engine configurations are owned by Veriq Labs. Users receive a limited, non-exclusive license to use the app.
          </Text>
        </View>

        {/* Section 7 */}
        <View className="mb-6 p-5 bg-surface/80 rounded-2xl border border-border/40">
          <Text className="text-primary font-mono text-xs font-bold mb-1">07. DISCLAIMER OF WARRANTIES</Text>
          <Text className="text-text font-headline text-base font-bold mb-2">As-Is Service</Text>
          <Text className="text-text-muted font-body text-xs leading-relaxed">
            Services are provided "AS-IS". While our AI strives for deep precision, we do not warrant that AI verdicts or web search evidence will be 100% error-free or exhaustive.
          </Text>
        </View>

        {/* Section 8 */}
        <View className="mb-8 p-5 bg-surface/80 rounded-2xl border border-border/40">
          <Text className="text-primary font-mono text-xs font-bold mb-1">08. GOVERNING LAW</Text>
          <Text className="text-text font-headline text-base font-bold mb-2">Jurisdiction</Text>
          <Text className="text-text-muted font-body text-xs leading-relaxed">
            These terms are governed by the laws of India. Any legal disputes shall be subject to the exclusive jurisdiction of the courts in New Delhi, India.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
