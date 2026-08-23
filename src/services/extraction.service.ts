import * as FileSystem from 'expo-file-system/legacy';

/**
 * Downloads the direct video URL on-device to a local temporary file.
 * Since FFmpegKit was retired on Jan 6, 2025 and its native prebuilts removed,
 * we stream the .mp4 file directly to Supabase. Groq's transcription engine
 * natively supports .mp4 video files, completely eliminating native compile bloat
 * and ensuring 100% build compatibility on all devices and Expo Go!
 *
 * @param mediaUrl The direct CDN video URL (e.g. .mp4)
 * @param outputPath The local file system destination path
 * @returns The output path on success
 */
export async function extractAudioFromUrl(mediaUrl: string, outputPath: string): Promise<string> {
  console.log('[Extraction] Downloading video stream locally (skipping obsolete native FFmpeg)...');
  console.log('[Extraction] Source URL:', mediaUrl);
  console.log('[Extraction] Local destination:', outputPath);

  try {
    const result = await FileSystem.downloadAsync(mediaUrl, outputPath);
    console.log('[Extraction] Download complete! HTTP Status:', result.status);

    if (result.status !== 200) {
      throw new Error(`Failed to download video stream. HTTP Status: ${result.status}`);
    }

    const fileInfo = await FileSystem.getInfoAsync(outputPath);
    if (!fileInfo.exists) {
      throw new Error('Video file was not created successfully after download.');
    }

    console.log('[Extraction] File verified. File size:', fileInfo.size, 'bytes');
    return outputPath;
  } catch (error: any) {
    console.error('[Extraction] Video download error:', error);
    throw error;
  }
}
