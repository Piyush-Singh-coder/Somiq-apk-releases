// ─── App Constants ────────────────────────────────────────────────────────────
// Central place for all app-wide constants.

export const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://10.0.2.2:4000';
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const RAZORPAY_KEY_ID = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ?? '';

// Regex to identify supported video URLs
export const YOUTUBE_SHORTS_REGEX = /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})|youtu\.be\/([a-zA-Z0-9_-]{11})/;
export const INSTAGRAM_REELS_REGEX = /instagram\.com\/reels?\/([a-zA-Z0-9_-]+)/;
export const TIKTOK_REGEX = /tiktok\.com\/@[a-zA-Z0-9_.-]+\/video\/([0-9]+)|vt\.tiktok\.com\/([a-zA-Z0-9_-]+)/;

// Tier credit limits (mirrors backend)
export const TIER_LIMITS = {
  FREE:    { daily: 2,   monthly: 8 },
  PREMIUM: { daily: null, monthly: 50 },
  PRO:     { daily: null, monthly: null },
} as const;

// Pricing display
export const PRICING = {
  PREMIUM: { monthly: '₹399', annual: '₹3,839', monthlyEquiv: '₹320' },
  PRO:     { monthly: '₹999', annual: '₹9,589', monthlyEquiv: '₹799' },
} as const;
