// ─── Shared Types ────────────────────────────────────────────────────────────
// All shared TypeScript types for the Somiq AI mobile app.
// Screens, services, and components import from here.

export type Tier = 'FREE' | 'PREMIUM' | 'PRO';
export type Platform = 'YOUTUBE' | 'INSTAGRAM' | 'TIKTOK' | 'LOCAL_VIDEO' | 'LOCAL_IMAGE';
export type PipelineStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type Verdict = 'TRUE' | 'FALSE' | 'MISLEADING' | 'PARTIALLY_TRUE' | 'DIRECTIONALLY_CORRECT' | 'TECHNICALLY_FLAWED' | 'OUTDATED' | 'SATIRE' | 'INCONCLUSIVE';
export type OverallCorrect = 'Yes' | 'No' | 'Partially' | 'Unverifiable' | 'Inconclusive';

export interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
  tier?: Tier;
  createdAt: string;
}

export interface Session {
  user: User;
  token: string;
  expiresAt: string;
}

export interface Claim {
  claim: string;
  verdict: Verdict;
  reason: string;
  confidence: number;
  sources: string[];
  usedReasoningModel?: boolean; // true = gemini-2.5-pro was used (PRO tier)
}

export interface VerificationResult {
  transcript?: string;
  englishTranscript?: string;
  detectedLanguage?: string;    // ISO 639-1 code e.g. "hi", "es", "en"
  hasVisualClaims?: boolean;    // true = transcript references visuals audio can't capture
  claims: Claim[];
  isFactualClaim: boolean;
  isContentCorrect: OverallCorrect;
  reason: string;
  sources: string[];
  webSearchUsed: boolean;
  localizedClaims?: LocalizedClaim[] | null; // PRO + non-English only
}

export interface LocalizedClaim {
  claim: string;          // original English claim
  localizedClaim: string; // translated claim text
  localizedReason: string;// translated verdict reason
}

export interface FactCheckLog {
  id: string;
  videoUrl: string;
  platform: Platform;
  videoId: string;
  status: PipelineStatus;
  isFactualClaim?: boolean;
  isContentCorrect?: OverallCorrect;
  reason?: string;
  verificationResult?: VerificationResult;
  transcript?: string | null;
  englishTranscript?: string | null;
  detectedLanguage?: string | null;   // ISO 639-1 reel source language
  hasVisualClaims?: boolean;           // visual disclaimer flag
  sources?: string[] | any;
  webSearchUsed?: boolean;
  createdAt: string;
  completedAt?: string;
  title?: string | null;
}

export interface BillingStatus {
  tier: Tier;
  subscriptionStatus?: string;
  subscriptionPeriodEnd?: string;
  billingInterval?: 'month' | 'year';
  razorpayPlanId?: string;
  usage?: {
    tier: Tier;
    daily: { used: number; limit: number | null };
    monthly: { used: number; limit: number | null };
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Navigation param types — fill these out when building screens
export type RootStackParamList = {
  Onboarding: undefined;
  Auth: undefined;
  Main: { screen?: keyof MainTabParamList } | undefined;
  Processing: { factCheckId?: string; url?: string; isLocalFile?: boolean; localPlatform?: Platform; isRefining?: boolean };
  Result: { factCheckId: string };
  Paywall: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  RefundPolicy: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Verification: undefined;
  History: undefined;
  Profile: undefined;
};

