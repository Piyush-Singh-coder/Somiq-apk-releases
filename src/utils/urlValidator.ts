// URL validation utilities for supported platforms
import { YOUTUBE_SHORTS_REGEX, INSTAGRAM_REELS_REGEX, TIKTOK_REGEX } from '@/constants';

export type SupportedPlatform = 'YOUTUBE' | 'INSTAGRAM' | 'TIKTOK';

export interface ParsedVideoUrl {
  platform: SupportedPlatform;
  videoId: string;
  originalUrl: string;
}

/**
 * Validates and extracts platform + video ID from a shared URL.
 * Returns null if the URL is not a supported format.
 */
export function parseVideoUrl(url: string): ParsedVideoUrl | null {
  const ytMatch = url.match(YOUTUBE_SHORTS_REGEX);
  if (ytMatch) {
    return {
      platform: 'YOUTUBE',
      videoId: ytMatch[1] ?? ytMatch[2] ?? '',
      originalUrl: url,
    };
  }

  const igMatch = url.match(INSTAGRAM_REELS_REGEX);
  if (igMatch) {
    return {
      platform: 'INSTAGRAM',
      videoId: igMatch[1] ?? '',
      originalUrl: url,
    };
  }

  const ttMatch = url.match(TIKTOK_REGEX);
  if (ttMatch) {
    return {
      platform: 'TIKTOK',
      videoId: ttMatch[1] ?? ttMatch[2] ?? '',
      originalUrl: url,
    };
  }

  return null;
}

export function isSupportedUrl(url: string): boolean {
  return parseVideoUrl(url) !== null;
}
