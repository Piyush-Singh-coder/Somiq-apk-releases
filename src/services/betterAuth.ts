import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// Read the deep link scheme from app.json — keeps it consistent with one source of truth
const appScheme = (Array.isArray(Constants.expoConfig?.scheme) 
  ? Constants.expoConfig.scheme[0] 
  : Constants.expoConfig?.scheme) ?? 'somiq';

// Mobile MUST go through the web proxy (somiq.veriqlabs.com/api/auth), NOT directly to the backend.
//
// WHY: The @better-auth/expo plugin generates the expo-authorization-proxy URL using the
// effective host of the request. If mobile calls the backend directly, the proxy URL is on
// veriq-ai-backend.onrender.com but the redirect_uri is on somiq.veriqlabs.com (from BETTER_AUTH_URL).
// This domain mismatch means the state cookie set during the proxy step is inaccessible when
// the Google callback arrives at somiq.veriqlabs.com → state_mismatch error.
//
// With the web proxy (proxy.ts), the proxy adds x-forwarded-host: somiq.veriqlabs.com, so Better Auth
// (trustHost: true) generates BOTH the expo-authorization-proxy URL AND the redirect_uri on
// somiq.veriqlabs.com → state cookie matches → expo() plugin redirects to somiq:// ✓
const authBaseURL = 'https://somiq.veriqlabs.com/api/auth';

export const betterAuthClient = createAuthClient({
  baseURL: authBaseURL,
  plugins: [
    expoClient({
      scheme: appScheme,
      storage: SecureStore,
    }),
  ],
});

