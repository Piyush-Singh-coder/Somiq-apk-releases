const INNERTUBE_API_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
const INNERTUBE_CLIENT_VERSION = '20.10.38';
const INNERTUBE_CONTEXT = {
  client: {
    clientName: 'ANDROID',
    clientVersion: INNERTUBE_CLIENT_VERSION,
  },
};
const INNERTUBE_USER_AGENT = `com.google.android.youtube/${INNERTUBE_CLIENT_VERSION} (Linux; U; Android 14)`;

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)';

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  name: { simpleText: string };
}

function decodeEntities(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

async function fetchTranscriptFromUrl(url: string): Promise<string> {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
    },
  });
  if (!resp.ok) {
    throw new Error('Failed to fetch transcript XML');
  }
  const xml = await resp.text();
  
  const results: string[] = [];
  
  // Try srv3 format: <p t="ms" d="ms"><s>word</s>...</p>
  const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  let match;
  while ((match = pRegex.exec(xml)) !== null) {
    const inner = match[3];
    let text = '';
    const sRegex = /<s[^>]*>([^<]*)<\/s>/g;
    let sMatch;
    while ((sMatch = sRegex.exec(inner)) !== null) {
      text += sMatch[1];
    }
    if (!text) {
      text = inner.replace(/<[^>]+>/g, '');
    }
    text = decodeEntities(text).trim();
    if (text) {
      results.push(text);
    }
  }
  
  if (results.length > 0) {
    return results.join(' ');
  }
  
  // Fall back to classic format: <text start="s" dur="s">content</text>
  const classicRegex = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;
  let classicMatch;
  while ((classicMatch = classicRegex.exec(xml)) !== null) {
    results.push(decodeEntities(classicMatch[3]));
  }
  
  return results.join(' ');
}

export async function fetchYouTubeTranscriptOnDevice(videoId: string): Promise<string | null> {
  // Try InnerTube API first
  try {
    const resp = await fetch(INNERTUBE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': INNERTUBE_USER_AGENT,
      },
      body: JSON.stringify({
        context: INNERTUBE_CONTEXT,
        videoId: videoId,
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      const captionTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks as CaptionTrack[];
      if (Array.isArray(captionTracks) && captionTracks.length > 0) {
        // Find English first, or Hindi, or fallback to the first track
        const track = captionTracks.find(t => t.languageCode === 'en') ||
                      captionTracks.find(t => t.languageCode === 'hi') ||
                      captionTracks[0];
        
        console.log(`[YT-OnDevice] Found caption track language: ${track.languageCode}`);
        const transcript = await fetchTranscriptFromUrl(track.baseUrl);
        if (transcript.trim().length > 10) {
          return transcript;
        }
      }
    }
  } catch (err) {
    console.warn('[YT-OnDevice] InnerTube fetch failed, attempting watch page scrape...', err);
  }

  // Scrape YouTube watch page as fallback
  try {
    const resp = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });
    if (!resp.ok) {
      return null;
    }
    const html = await resp.text();
    
    // Parse ytInitialPlayerResponse inline json
    const startToken = `var ytInitialPlayerResponse = `;
    const startIndex = html.indexOf(startToken);
    if (startIndex !== -1) {
      const jsonStart = startIndex + startToken.length;
      let depth = 0;
      let jsonStr = '';
      for (let i = jsonStart; i < html.length; i++) {
        if (html[i] === '{') depth++;
        else if (html[i] === '}') {
          depth--;
          if (depth === 0) {
            jsonStr = html.slice(jsonStart, i + 1);
            break;
          }
        }
      }
      if (jsonStr) {
        const playerResponse = JSON.parse(jsonStr);
        const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks as CaptionTrack[];
        if (Array.isArray(captionTracks) && captionTracks.length > 0) {
          const track = captionTracks.find(t => t.languageCode === 'en') ||
                        captionTracks.find(t => t.languageCode === 'hi') ||
                        captionTracks[0];
          const transcript = await fetchTranscriptFromUrl(track.baseUrl);
          if (transcript.trim().length > 10) {
            return transcript;
          }
        }
      }
    }
  } catch (err) {
    console.error('[YT-OnDevice] Scrape failed:', err);
  }

  return null;
}
