/**
 * TikTok video direct URL extractor.
 * 
 * Runs entirely on-device (residential IP) using a public free downloader API (tikwm).
 * This bypasses TikTok's cloudflare bot protection and retrieves the direct,
 * watermark-free video CDN URL.
 */

export async function extractTikTokDirectUrl(tiktokUrl: string): Promise<string> {
  console.log('[TikTokExtractor] Extracting direct video link for:', tiktokUrl);
  try {
    const apiURL = `https://www.tikwm.com/api/?url=${encodeURIComponent(tiktokUrl)}`;
    const response = await fetch(apiURL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`tikwm API returned HTTP ${response.status}`);
    }

    const resData = await response.json();
    if (resData && resData.code === 0 && resData.data && resData.data.play) {
      const playUrl = resData.data.play;
      console.log('[TikTokExtractor] ✅ Successfully extracted direct TikTok CDN URL');
      return playUrl;
    } else {
      const errMsg = resData?.msg || 'Invalid API response';
      throw new Error(errMsg);
    }
  } catch (err: any) {
    console.error('[TikTokExtractor] Extraction failed:', err);
    throw new Error(
      err.message || 'Could not connect to the TikTok video extraction server.'
    );
  }
}
