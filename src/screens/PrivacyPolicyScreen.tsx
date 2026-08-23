import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';

export default function PrivacyPolicyScreen() {
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
          <Text className="text-text font-headline text-base font-bold">Privacy Policy</Text>
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
          <Text className="text-primary font-mono text-[10px] font-bold uppercase mb-1">PRIVACY COMPLIANCE</Text>
          <Text className="text-text font-headline text-lg font-bold">Your Privacy is Our Priority</Text>
          <Text className="text-text-muted font-body text-xs mt-1">
            Last Updated: June 16, 2026. We do not track you, sell your data, or compromise your personal information.
          </Text>
        </View>

        {/* Section 1 */}
        <View className="mb-6 p-5 bg-surface/80 rounded-2xl border border-border/40">
          <Text className="text-primary font-mono text-xs font-bold mb-1">01. COMMITMENT TO PRIVACY</Text>
          <Text className="text-text font-headline text-base font-bold mb-2">Data Sovereignty & Minimization</Text>
          <Text className="text-text-muted font-body text-xs leading-relaxed">
            At Somiq, we believe privacy is a fundamental human right. Our AI content verification platform is engineered around local data minimization. We pledge to never sell, monetize, or rent your personal data, check history, or telemetry records to any third party.
          </Text>
        </View>

        {/* Section 2 */}
        <View className="mb-6 p-5 bg-surface/80 rounded-2xl border border-border/40">
          <Text className="text-primary font-mono text-xs font-bold mb-1">02. INFORMATION WE COLLECT</Text>
          <Text className="text-text font-headline text-base font-bold mb-2">Essential Data Only</Text>
          <Text className="text-text-muted font-body text-xs leading-relaxed mb-2">
            We only collect the minimum data required to deliver core verification features and maintain user sessions:
          </Text>
          <Text className="text-text-muted font-body text-xs leading-relaxed">
            • Account Credentials: Email, encrypted passwords, and profile name (via BetterAuth).{'\n'}
            • Social Authentication: Email, name, and profile image provided via Google OAuth.{'\n'}
            • Billing Information: Payment transaction metadata via Razorpay. We do not store credit card or UPI details on our servers.{'\n'}
            • Verification Logs: Saved claim verification reports associated with your account.
          </Text>
        </View>

        {/* Section 3 */}
        <View className="mb-6 p-5 bg-surface/80 rounded-2xl border border-border/40">
          <Text className="text-primary font-mono text-xs font-bold mb-1">03. ON-DEVICE LOCAL ISOLATION</Text>
          <Text className="text-text font-headline text-base font-bold mb-2">Zero-Cloud Audio Processing</Text>
          <Text className="text-text-muted font-body text-xs leading-relaxed">
            When you verify a video link (YouTube Shorts, Instagram Reels, TikTok) on the Mobile App, audio extraction and WebView sandboxing occur directly on your physical device. Raw video files and full audio streams are NOT stored on Somiq cloud servers.
          </Text>
        </View>

        {/* Section 4 */}
        <View className="mb-6 p-5 bg-surface/80 rounded-2xl border border-border/40">
          <Text className="text-primary font-mono text-xs font-bold mb-1">04. HOW WE USE YOUR DATA</Text>
          <Text className="text-text font-headline text-base font-bold mb-2">Operational Purpose</Text>
          <Text className="text-text-muted font-body text-xs leading-relaxed">
            Your data is used exclusively to: validate logins, enforce tier daily/monthly quotas (Free vs Premium vs Pro), initiate checkout sessions with Razorpay, render your history dashboard, and send critical account notices.
          </Text>
        </View>

        {/* Section 5 */}
        <View className="mb-6 p-5 bg-surface/80 rounded-2xl border border-border/40">
          <Text className="text-primary font-mono text-xs font-bold mb-1">05. THIRD-PARTY INTEGRATIONS</Text>
          <Text className="text-text font-headline text-base font-bold mb-2">Trusted Service Processors</Text>
          <Text className="text-text-muted font-body text-xs leading-relaxed">
            We partner with Razorpay (payment processing), Google OAuth (identity), and secure AI clusters (text assertion verification). Text hashes sent to AI models do not include user identifying details.
          </Text>
        </View>

        {/* Section 6 */}
        <View className="mb-6 p-5 bg-surface/80 rounded-2xl border border-border/40">
          <Text className="text-primary font-mono text-xs font-bold mb-1">06. DATA SECURITY & ENCRYPTION</Text>
          <Text className="text-text font-headline text-base font-bold mb-2">TLS 1.3 & Encrypted Storage</Text>
          <Text className="text-text-muted font-body text-xs leading-relaxed">
            All API calls use TLS 1.3 encryption. Mobile credentials and tokens are stored in the device's hardware-backed SecureStore keystore. Production databases are protected behind secure firewalls and VPC isolation.
          </Text>
        </View>

        {/* Section 7 */}
        <View className="mb-6 p-5 bg-surface/80 rounded-2xl border border-border/40">
          <Text className="text-primary font-mono text-xs font-bold mb-1">07. YOUR RIGHTS & DATA DELETION</Text>
          <Text className="text-text font-headline text-base font-bold mb-2">Full Account Control</Text>
          <Text className="text-text-muted font-body text-xs leading-relaxed">
            You can delete individual verification reports from your history anytime. You also have the right to request full account deletion, which purges all your registration and history data within 48 hours.
          </Text>
        </View>

        {/* Section 8 */}
        <View className="mb-8 p-5 bg-surface/80 rounded-2xl border border-border/40">
          <Text className="text-primary font-mono text-xs font-bold mb-1">08. CONTACT PRIVACY OFFICER</Text>
          <Text className="text-text font-headline text-base font-bold mb-2">Reach Support Team</Text>
          <Text className="text-text-muted font-body text-xs leading-relaxed">
            Email: support@veriqlabs.com{'\n'}
            Web Help: https://somiq.veriqlabs.com/support
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
