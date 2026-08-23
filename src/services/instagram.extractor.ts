/**
 * Instagram Reel direct video URL extractor.
 *
 * Runs entirely on the user's device (residential / cellular IP), so Instagram's
 * datacenter-IP blocking does NOT apply.  No native binaries, no extra packages —
 * just a plain `fetch` call and regex parsing.
 *
 * KEY FINDING (2025):
 *   - Instagram's Reel page (/reel/ID/) is a pure SPA: ZERO video data in HTML.
 *   - Instagram's EMBED page (/reel/ID/embed/) IS server-rendered and contains
 *     the `video_url` field in an embedded JSON blob.
 *   - The URL is encoded with multiple layers of JSON escaping inside the HTML:
 *       video_url\":\"https:\\\\/\\\\/instagram.fXXX.fna.fbcdn.net\\/...\\.mp4
 *   - Pattern: /video_url[^h]+(https[^"]{20,}\.mp4[^"]{0,300})/
 *   - Unescape: replace \\\\/ with / (then \/ with /)
 */

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

/**
 * Converts an Instagram Reel URL to its embed URL.
 * e.g. https://www.instagram.com/reel/ABC123/?igsh=XYZ → https://www.instagram.com/reel/ABC123/embed/
 */
function toEmbedUrl(reelUrl: string): string {
  try {
    const u = new URL(reelUrl);
    const basePath = u.pathname.replace(/\/?$/, '/');
    return `${u.origin}${basePath}embed/`;
  } catch {
    const base = reelUrl.split('?')[0].replace(/\/?$/, '/');
    return `${base}embed/`;
  }
}

/**
 * Decode Instagram's multi-level URL escaping from the embed page HTML.
 *
 * The embed page stores URLs as: https:\\\\/\\\\/instagram.fXXX.fna.fbcdn.net\\\\/...
 * Each level: HTML embeds JSON, JSON embeds JS, JS embeds JSON → multiple escapes.
 */
function unescapeInstagramUrl(s: string): string {
  let decoded = s.trim();
  
  if (decoded.endsWith('\\')) {
    decoded = decoded.substring(0, decoded.length - 1);
  }
  
  if (decoded.charAt(0) === '"' && decoded.charAt(decoded.length - 1) === '"') {
    decoded = decoded.substring(1, decoded.length - 1);
  }

  decoded = decoded.replace(/%5C/gi, '\\');

  let prev;
  let limit = 5;
  do {
    prev = decoded;
    
    // 1. Replace escaped slashes
    decoded = decoded.replace(/\\\\\//g, '/');
    decoded = decoded.replace(/\\\//g, '/');
    
    // 2. Replace escaped ampersands
    decoded = decoded.replace(/\\u0026|\\\\u0026/gi, '&');
    decoded = decoded.replace(/&amp;/g, '&');
    
    // 3. Replace escaped equals
    decoded = decoded.replace(/\\u003d|\\\\u003d|\\u003D|\\\\u003D/gi, '=');
    
    // 4. Replace escaped percent signs (\\u00253D -> %3D)
    decoded = decoded.replace(/\\u00253D|\\\\u00253D/gi, '%3D');
    decoded = decoded.replace(/%253D|%3D/gi, '=');
    decoded = decoded.replace(/\\u0025|\\\\u0025/gi, '%');
    
  } while (decoded !== prev && --limit > 0);

  if (decoded.endsWith('\\')) {
    decoded = decoded.substring(0, decoded.length - 1);
  }

  return decoded;
}

/**
 * Attempts to extract the direct video URL from an Instagram Reel embed page.
 * Throws if extraction fails (private Reel, age-restricted, etc.)
 *
 * @param reelUrl   Instagram Reel URL (any form — tracking params handled automatically)
 * @returns         Direct video CDN URL (https://instagram.fXXX.fna.fbcdn.net/...mp4...)
 */
export async function extractInstagramDirectUrl(reelUrl: string): Promise<string> {
  const embedUrl = toEmbedUrl(reelUrl);
  console.log('[InstagramExtractor] Fetching embed page:', embedUrl);

  const response = await fetch(embedUrl, {
    method: 'GET',
    headers: {
      'User-Agent': MOBILE_UA,
      'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      // Referer makes the request look like a legitimate embedded-post load
      'Referer': 'https://www.instagram.com/',
    },
  });

  if (!response.ok) {
    throw new Error(`Instagram embed page returned HTTP ${response.status}`);
  }

  const html = await response.text();
  console.log('[InstagramExtractor] Embed HTML length:', html.length);

  // ── Detect well-known failure states before searching for the URL ──────────
  if (
    html.includes('login_required') ||
    html.includes('loginPromptContainerClass') ||
    html.length < 500 // near-empty page = session wall or error
  ) {
    throw new Error(
      'This Instagram Reel requires login to view. Only public reels can be fact-checked.',
    );
  }
  if (html.includes('media_not_found') || html.includes('Sorry, this page isn')) {
    throw new Error(
      'This Instagram Reel is no longer available (deleted or moved).',
    );
  }
  // ── Primary: match video_url field followed by the escaped CDN URL ─────────
  // Pattern validated against real HTML: video_url\":\"https:\\\\/\\\\/instagram.fXXX...mp4
  const m = html.match(/video_url[^h]+(https[^"]{20,}\.mp4[^"]+)/);
  if (m?.[1]) {
    // Extract up to the first unescaped quote (end of URL value)
    const rawUrl = m[1].split('"')[0];
    const cleanUrl = unescapeInstagramUrl(rawUrl);

    if (cleanUrl.startsWith('https://') && cleanUrl.length > 40) {
      console.log('[InstagramExtractor] ✅ Found via video_url field in embed HTML');
      return cleanUrl;
    }
  }

  // ── Fallback: any fbcdn or cdninstagram .mp4 URL ─────────────────────────
  const fallbackPatterns = [
    /https[^"]{0,10}instagram\.[a-z0-9.-]+\.fna\.fbcdn\.net[^"]{20,}\.mp4[^"]+/,
    /https[^"]{0,10}scontent[a-z0-9.-]*\.cdninstagram\.com[^"]{20,}\.mp4[^"]+/,
  ];
  for (const pat of fallbackPatterns) {
    const fm = html.match(pat);
    if (fm?.[0]) {
      const cleanUrl = unescapeInstagramUrl(fm[0].split('"')[0]);
      if (cleanUrl.startsWith('https://')) {
        console.log('[InstagramExtractor] ✅ Found via fallback CDN scan in embed HTML');
        return cleanUrl;
      }
    }
  }

  throw new Error(
    'InstagramExtractor: no video URL found in embed page. ' +
    'The Reel may be private, age-restricted, or deleted.',
  );
}
