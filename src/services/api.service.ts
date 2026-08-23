// API service — all HTTP calls to the backend
// Screens and hooks use this service, never call fetch/axios directly.

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { BACKEND_URL } from '@/constants';
import * as FileSystem from 'expo-file-system/legacy';
import type {
  FactCheckLog,
  BillingStatus,
  PaginatedResponse,
} from '@/types';

const api = axios.create({
  baseURL: BACKEND_URL,
  timeout: 15_000,
  // React Native doesn't send an Origin header by default.
  // Better-Auth enforces origin checking, so we must set it explicitly.
  headers: {
    Origin: BACKEND_URL,
  },
});

// Attach session token from SecureStore automatically
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('session_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    // Better-Auth also reads the cookie header
    config.headers.Cookie = `better-auth.session_token=${token}`;
  }
  // Ensure Origin header is always present (Better-Auth requirement)
  if (!config.headers.Origin) {
    config.headers.Origin = BACKEND_URL;
  }
  return config;
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  signUp: (email: string, password: string, name: string) =>
    api.post('/api/auth/sign-up/email', { email, password, name }),

  signIn: (email: string, password: string) =>
    api.post('/api/auth/sign-in/email', { email, password }),

  signOut: () =>
    api.post('/api/auth/sign-out'),

  getSession: () =>
    api.get('/api/auth/get-session'),

  // Returns the Google OAuth URL to open in expo-web-browser
  getGoogleOAuthUrl: () => `${BACKEND_URL}/api/auth/sign-in/google`,

  registerPushToken: async (token: string) => {
    const response = await api.post('/api/v1/users/push-token', { token });
    return response.data;
  },
};

// ─── Media / Fact Check ───────────────────────────────────────────────────────

export const mediaApi = {
  createUploadIntent: (videoUrl: string, platform: string, videoId: string, transcript?: string) =>
    api.post<{
      factCheckId: string;
      uploadUrl: string;
      objectKey: string;
      expiresIn: number;
      cached?: boolean;
      result?: any;
      isSubscribed?: boolean;
    }>('/api/v1/media/upload-intent', { videoUrl, platform, videoId, transcript }),

  confirmUpload: (factCheckId: string) =>
    api.post<{
      factCheckId: string;
      status: string;
      youtubeTranscriptUsed: boolean;
    }>('/api/v1/media/confirm-upload', { factCheckId }),

  /**
   * Sends the direct CDN video URL (extracted on-device) to the backend.
   * The backend downloads the raw video from the CDN and uploads it to Supabase,
   * then triggers the AI engine — mobile only needs to listen on WebSocket.
   */
  resolveDirectUrl: (factCheckId: string, directVideoUrl: string) =>
    api.post<{ factCheckId: string; status: string }>(
      '/api/v1/media/resolve-direct-url',
      { factCheckId, directVideoUrl }
    ),

  async uploadAudioToSupabase(uploadUrl: string, audioPath: string) {
    console.log('[MediaAPI] Uploading binary to Supabase signed URL via native FileSystem...');
    const uri = audioPath.startsWith('file://') ? audioPath : `file://${audioPath}`;
    const lowerPath = audioPath.toLowerCase();

    let contentType = 'audio/mpeg';
    if (lowerPath.endsWith('.mp4') || lowerPath.endsWith('.mov') || lowerPath.endsWith('.webm')) {
      contentType = 'video/mp4';
    } else if (lowerPath.endsWith('.png')) {
      contentType = 'image/png';
    } else if (lowerPath.endsWith('.webp')) {
      contentType = 'image/webp';
    } else if (lowerPath.endsWith('.heic') || lowerPath.endsWith('.heif')) {
      contentType = 'image/heic';
    } else if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg')) {
      contentType = 'image/jpeg';
    }

    const result = await FileSystem.uploadAsync(uploadUrl, uri, {
      httpMethod: 'PUT',
      uploadType: 0 as any, // 0 corresponds to FileSystemUploadType.BINARY_CONTENT
      headers: {
        'Content-Type': contentType,
      },
    });

    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Supabase upload failed with status ${result.status}: ${result.body}`);
    }
    console.log('[MediaAPI] Binary successfully uploaded to Supabase.');
  },
};

export const factCheckApi = {
  getHistory: (page = 1, limit = 10, filters?: { platform?: string; status?: string; isLocal?: boolean; search?: string }) =>
    api.get<PaginatedResponse<FactCheckLog>>('/api/v1/factcheck/history', {
      params: { 
        page, 
        limit, 
        platform: filters?.platform, 
        status: filters?.status, 
        isLocal: filters?.isLocal ? 'true' : undefined,
        search: filters?.search
      },
    }),

  getVaultStats: () =>
    api.get<{
      total: number;
      factual: number;
      misleading: number;
      partiallyTrue: number;
      opinion: number;
      // Legacy keys (kept for backward compatibility)
      verifiable: number;
      unverifiable: number;
    }>('/api/v1/factcheck/vault-stats'),

  getById: (id: string) =>
    api.get<FactCheckLog>(`/api/v1/factcheck/${id}`),

  deleteLog: (id: string) =>
    api.delete<{ success: boolean }>(`/api/v1/factcheck/${id}`),

  updateLog: (id: string, title: string) =>
    api.patch<FactCheckLog>(`/api/v1/factcheck/${id}`, { title }),

  requestRevision: (id: string, notes?: string) =>
    api.post<{ success: boolean; message: string }>(`/api/v1/factcheck/${id}/revision`, { notes }),

  retryVerification: (id: string) =>
    api.post<{ success: boolean; message: string }>(`/api/v1/factcheck/${id}/retry`),

  getRevisions: () =>
    api.get<{ success: boolean; items: any[] }>('/api/v1/factcheck/revisions'),

  getPdfReport: (id: string) =>
    api.get<{ success: boolean; downloadUrl: string }>(`/api/v1/factcheck/${id}/pdf`),
};

// ─── Billing ──────────────────────────────────────────────────────────────────

export const billingApi = {
  getStatus: () =>
    api.get<BillingStatus>('/api/v1/billing/status'),

  createCheckout: (
    plan: 'PREMIUM' | 'PRO',
    interval: 'month' | 'year' | '3months' | '6months',
    gateway: 'RAZORPAY' | 'PADDLE' | 'POLAR' = 'RAZORPAY',
    successUrl?: string
  ) =>
    api.post<{ subscriptionId?: string; keyId?: string; checkoutUrl?: string }>(
      '/api/v1/billing/create-checkout',
      { plan, interval, gateway, successUrl }
    ),

  // NOTE: 'plan' is intentionally NOT sent — the backend derives the tier
  // from Razorpay's subscription data to prevent plan manipulation attacks.
  verifyPayment: (
    razorpay_payment_id: string,
    razorpay_subscription_id: string,
    razorpay_signature: string,
  ) =>
    api.post<{ success: boolean; tier: string; alreadyProcessed: boolean; message: string }>(
      '/api/v1/billing/verify-payment',
      {
        razorpay_payment_id,
        razorpay_subscription_id,
        razorpay_signature,
      }
    ),
};

export default api;
