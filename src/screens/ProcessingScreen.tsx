import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/types";
import { colors } from "@/theme/colors";
import { parseVideoUrl } from "@/utils/urlValidator";
import { mediaApi, factCheckApi } from "@/services/api.service";
import { socketService } from "@/services/socket.service";
import { authService } from "@/services/auth.service";
import WebViewExtractor from "@/components/WebViewExtractor";
import { extractInstagramDirectUrl } from "@/services/instagram.extractor";
import { extractTikTokDirectUrl } from "@/services/tiktok.extractor";
import { fetchYouTubeTranscriptOnDevice } from "@/services/youtubeTranscript.service";
import { MaterialIcons } from "@expo/vector-icons";
import { useToast } from "@/hooks/useToast";
import { cleanErrorMessage } from "@/utils/errors";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ProcessingRouteProp = RouteProp<RootStackParamList, "Processing">;

interface ProcessStep {
  id: number;
  title: string;
  subtitle: string;
  status: "pending" | "active" | "completed";
  progress?: number;
}

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

export default function ProcessingScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ProcessingRouteProp>();
  const targetUrl = route.params?.url || "https://youtube.com/shorts/test";

  const { showToast, showDialog } = useToast();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const [steps, setSteps] = useState<ProcessStep[]>([
    {
      id: 1,
      title: "Extracting Audio",
      subtitle: "Isolating speaker channels...",
      status: "active",
      progress: 0,
    },
    {
      id: 2,
      title: "Transcribing",
      subtitle: "Neural linguistic mapping...",
      status: "pending",
    },
    {
      id: 3,
      title: "Detecting Claims",
      subtitle: "Identifying key statements...",
      status: "pending",
    },
    {
      id: 4,
      title: "Fact Checking",
      subtitle: "Verifying against digital archives...",
      status: "pending",
    },
    {
      id: 5,
      title: "AI Verification",
      subtitle: "Neural Somiq calculations...",
      status: "pending",
    },
  ]);

  // State to track if it's safe to close/navigate away
  const [canCloseApp, setCanCloseApp] = useState(false); // true after step 1 is done

  // Show "you can close" option after step 1 completes (meaning file is uploaded/resolved on server)
  useEffect(() => {
    const completedCount = steps.filter(s => s.status === 'completed').length;
    if (completedCount >= 1 && !canCloseApp) {
      setCanCloseApp(true);
    }
  }, [steps]);

  // Show toast notice when it is safe to leave
  useEffect(() => {
    if (canCloseApp) {
      showToast({
        title: "Processing Secured",
        message: "You can safely return to the home screen or close the app. The AI engine runs on our servers.",
        type: "success",
        duration: 5000,
      });
    }
  }, [canCloseApp]);




  /**
   * Tracks Instagram state: whether to show the hidden WebView extractor
   * and which factCheckId to associate the extracted URL with.
   *
   * `isExtracting` → shows the WebViewExtractor as a fallback when the fast
   *   fetch-based extraction failed for this Reel.
   */
  const [instagramState, setInstagramState] = useState<{
    factCheckId: string;
    isExtracting: boolean;
  } | null>(null);

  const activeStepIndexRef = useRef(0);

  // Waveform animations
  const wave1 = useRef(new Animated.Value(1)).current;
  const wave2 = useRef(new Animated.Value(1)).current;
  const wave3 = useRef(new Animated.Value(1)).current;
  const wave4 = useRef(new Animated.Value(1)).current;
  const wave5 = useRef(new Animated.Value(1)).current;

  // Scanner animations
  const scanAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const [containerWidth, setContainerWidth] = useState(300);

  // ─── Shared handler: called once we have a direct CDN video URL ────────────
  // Whether it comes from the fast fetch extractor or the WebView fallback,
  // we hand the raw CDN URL to the backend via resolveDirectUrl.
  // The backend downloads it, uploads to Supabase, and triggers the AI engine.
  // Mobile only needs to sit and listen on the WebSocket.
  const handleUrlExtracted = async (directUrl: string) => {
    if (!instagramState) return;
    const { factCheckId } = instagramState;
    const cleanUrl = unescapeInstagramUrl(directUrl);
    console.log(
      "[ProcessingScreen] Direct CDN URL extracted:",
      cleanUrl.substring(0, 80) + "...",
    );

    // Stop the WebView (unmount it) immediately — we have what we need
    setInstagramState(null);

    try {
      // Hand the clean CDN URL to the backend. Backend downloads + uploads to Supabase.
      console.log("[ProcessingScreen] Calling resolveDirectUrl on backend...");
      await mediaApi.resolveDirectUrl(factCheckId, cleanUrl);
      console.log(
        "[ProcessingScreen] resolveDirectUrl accepted — waiting for WebSocket...",
      );

      // Advance UI: extraction done → show Transcribing as next active step
      setSteps((prev) =>
        prev.map((s, idx) => {
          if (idx === 0) return { ...s, status: "completed", progress: 100 };
          if (idx === 1) return { ...s, status: "active", progress: 0 };
          return s;
        }),
      );
      activeStepIndexRef.current = 1;
    } catch (err: any) {
      if (!isMounted.current) return;
      const errMsg = cleanErrorMessage(
        err?.response?.data?.message || err.message,
        "Could not send video to server for processing."
      );
      showDialog({
        title: "Processing Failed",
        message: errMsg,
        buttons: [{ text: "Go Back", onPress: () => { if (isMounted.current) navigation.goBack(); } }],
      });
    }
  };

  // ─── WebView fallback failed ───────────────────────────────────────────────
  const handleExtractionError = async (error: string) => {
    console.log("[ProcessingScreen] WebView extraction failed:", error);
    if (!instagramState) return;

    const { factCheckId } = instagramState;

    // Stop WebView
    setInstagramState(null);

    // Completely delete the pending fact check log from history
    try {
      console.log(`[ProcessingScreen] Deleting pending fact check log ${factCheckId} from history...`);
      await factCheckApi.deleteLog(factCheckId);
    } catch (deleteErr) {
      console.warn("[ProcessingScreen] Failed to delete pending fact check log:", deleteErr);
    }

    showDialog({
      title: "Extraction Failed",
      message: "Could not extract the video from Instagram. The Reel may be private, age-restricted, a collaborative/co-authored post, or contain copyright-restricted music (which prevents embedding).\n\nTip: You can download the Reel to your device gallery and upload it directly using the 'Upload Video' option on the home screen.",
      buttons: [{ text: "Go Back", onPress: () => { if (isMounted.current) navigation.goBack(); } }],
    });
  };

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    let updateUnsubscribe: (() => void) | null = null;

    const paramFactCheckId = route.params?.factCheckId;
    const isRefining = route.params?.isRefining;

    const parsedUrl = (route.params?.isLocalFile || paramFactCheckId)
      ? { platform: (route.params?.localPlatform || 'YOUTUBE') as string, videoId: 'LOCAL' }
      : parseVideoUrl(targetUrl);
    
    if (!parsedUrl && !paramFactCheckId) {
      showDialog({
        title: "Unsupported Link",
        message: "Please provide a valid YouTube Shorts, Instagram Reels or TikTok URL.",
        buttons: [{ text: "Go Back", onPress: () => { if (isMounted.current) navigation.goBack(); } }],
      });
      return;
    }

    async function startPipeline() {
      try {
        const user = await authService.getUser();
        if (!user) {
          showDialog({
            title: "Session Expired",
            message: "Please authenticate to start verification.",
            buttons: [{ text: "Authenticate", onPress: () => { if (isMounted.current) navigation.replace("Auth"); } }],
          });
          return;
        }

        // 1. Establish WebSocket Connection (auth via Bearer token in handshake)
        console.log("[Pipeline] Connecting to WebSocket...");
        await socketService.connect();

        let factCheckId = paramFactCheckId;

        if (paramFactCheckId) {
          console.log("[Pipeline] Retrying/Refining existing factCheckId:", paramFactCheckId);
          
          if (isRefining) {
            // Setup steps for refinement
            setSteps([
              { id: 1, title: "Extracting Audio", subtitle: "Isolating speaker channels...", status: "completed", progress: 100 },
              { id: 2, title: "Transcribing", subtitle: "Neural linguistic mapping...", status: "completed", progress: 100 },
              { id: 3, title: "Detecting Claims", subtitle: "Identifying key statements...", status: "completed", progress: 100 },
              { id: 4, title: "Refining Fact Checking", subtitle: "Re-verifying against digital archives...", status: "active", progress: 0 },
              { id: 5, title: "AI Re-Verification", subtitle: "Neural Somiq calculations...", status: "pending" },
            ]);
            activeStepIndexRef.current = 3;
          } else {
            // Setup steps for restart retry
            setSteps([
              { id: 1, title: "Extracting Audio", subtitle: "Isolating speaker channels...", status: "active", progress: 0 },
              { id: 2, title: "Transcribing", subtitle: "Neural linguistic mapping...", status: "pending" },
              { id: 3, title: "Detecting Claims", subtitle: "Identifying key statements...", status: "pending" },
              { id: 4, title: "Fact Checking", subtitle: "Verifying against digital archives...", status: "pending" },
              { id: 5, title: "AI Verification", subtitle: "Neural Somiq calculations...", status: "pending" },
            ]);
            activeStepIndexRef.current = 0;
          }
        } else {
          // 2. Create Upload Intent on Backend for new checks
          console.log("[Pipeline] Creating upload intent for URL:", targetUrl);
          let ytTranscript: string | undefined;
          if (parsedUrl!.platform === "YOUTUBE") {
            try {
              console.log("[Pipeline] Fetching YouTube transcript on-device...");
              const fetched = await fetchYouTubeTranscriptOnDevice(parsedUrl!.videoId);
              if (fetched) {
                ytTranscript = fetched;
                console.log(`[Pipeline] Successfully fetched YouTube transcript on-device (${fetched.length} chars)`);
              } else {
                console.log("[Pipeline] YouTube transcript not available on-device.");
              }
            } catch (err) {
              console.warn("[Pipeline] Error fetching YouTube transcript on-device:", err);
            }
          }

          const intentRes = await mediaApi.createUploadIntent(
            targetUrl,
            parsedUrl!.platform,
            parsedUrl!.videoId,
            ytTranscript,
          );

          const intentData = intentRes.data;
          factCheckId = intentData.factCheckId;

          if (intentData.cached && intentData.result) {
            setSteps((prev) =>
              prev.map((s) => ({ ...s, status: "completed", progress: 100 })),
            );
            setTimeout(() => {
              if (isMounted.current) {
                navigation.replace("Result", { factCheckId: intentData.factCheckId });
              }
            }, 800);
            return;
          }

          if (intentData.isSubscribed) {
            console.log("[Pipeline] Subscribed to existing in-progress check:", intentData.factCheckId);
            setSteps((prev) =>
              prev.map((s, idx) => {
                if (idx === 0) return { ...s, status: "completed", progress: 100 };
                if (idx === 1) return { ...s, status: "active", progress: 0 };
                return s;
              }),
            );
            activeStepIndexRef.current = 1;
          } else if (route.params?.isLocalFile && intentData.uploadUrl) {
            console.log("[Pipeline] Uploading local file to Supabase...");
            await mediaApi.uploadAudioToSupabase(intentData.uploadUrl, targetUrl);
            console.log("[Pipeline] File uploaded, confirming...");
            await mediaApi.confirmUpload(intentData.factCheckId);
            setSteps((prev) =>
              prev.map((s, idx) => {
                if (idx === 0) return { ...s, status: "completed", progress: 100 };
                if (idx === 1) return { ...s, status: "active", progress: 0 };
                return s;
              }),
            );
            activeStepIndexRef.current = 1;
          } else if (parsedUrl!.platform === "INSTAGRAM") {
            // Instagram embed-page extraction path...
            try {
              const directUrl = await extractInstagramDirectUrl(targetUrl);
              if (!isMounted.current) return;
              const cleanUrl = unescapeInstagramUrl(directUrl);
              await mediaApi.resolveDirectUrl(intentData.factCheckId, cleanUrl);
              setSteps((prev) =>
                prev.map((s, idx) => {
                  if (idx === 0) return { ...s, status: "completed", progress: 100 };
                  if (idx === 1) return { ...s, status: "active", progress: 0 };
                  return s;
                }),
              );
              activeStepIndexRef.current = 1;
            } catch (fastErr) {
              if (!isMounted.current) return;
              setInstagramState({ factCheckId: intentData.factCheckId, isExtracting: true });
            }
          } else if (parsedUrl!.platform === "TIKTOK") {
            // TikTok extraction path
            try {
              const directUrl = await extractTikTokDirectUrl(targetUrl);
              if (!isMounted.current) return;
              await mediaApi.resolveDirectUrl(intentData.factCheckId, directUrl);
              setSteps((prev) =>
                prev.map((s, idx) => {
                  if (idx === 0) return { ...s, status: "completed", progress: 100 };
                  if (idx === 1) return { ...s, status: "active", progress: 0 };
                  return s;
                }),
              );
              activeStepIndexRef.current = 1;
            } catch (err: any) {
              if (!isMounted.current) return;
              showDialog({
                title: "Extraction Failed",
                message: err.message || "Could not extract TikTok video source. The video might be private or unavailable.",
                buttons: [{ text: "Go Back", onPress: () => { if (isMounted.current) navigation.goBack(); } }],
              });
            }
          } else {
            // YouTube fast-path
            setSteps((prev) =>
              prev.map((s, idx) => {
                if (idx === 0) return { ...s, status: "completed", progress: 100 };
                if (idx === 1) return { ...s, status: "active", progress: 0 };
                return s;
              }),
            );
            activeStepIndexRef.current = 1;
          }
        }

        // 3. Subscribe to live WebSocket events for this factCheckId
        const unsub = socketService.onFactCheckUpdate((data) => {
          if (data.factCheckId === factCheckId && isMounted.current) {
            console.log("[Pipeline] WebSocket update:", data.status);

            if (data.status === "COMPLETED") {
              setSteps((prev) =>
                prev.map((s) => ({ ...s, status: "completed", progress: 100 })),
              );
              setTimeout(() => {
                if (isMounted.current) {
                  navigation.replace("Result", { factCheckId: factCheckId! });
                }
              }, 800);
            } else if (data.status === "FAILED") {
              if (!isMounted.current) return;
              showDialog({
                title: "Analysis Failed",
                message: data.errorMessage || "AI engine failed to verify this content.",
                buttons: [{ text: "OK", onPress: () => { if (isMounted.current) navigation.goBack(); } }],
              });
            }
          }
        });

        if (isMounted.current) {
          unsubscribeRef.current = unsub;
        } else {
          unsub();
        }

      } catch (err: any) {
        if (!isMounted.current) return;
        console.error(
          "[Pipeline] Execution failed:",
          err?.response?.data || err.message,
        );
        const errMsg = cleanErrorMessage(
          err?.response?.data?.message,
          "Could not verify statement. Please check backend connection."
        );
        showDialog({
          title: "Verification Failed",
          message: errMsg,
          buttons: [{ text: "OK", onPress: () => { if (isMounted.current) navigation.goBack(); } }],
        });
      }
    }

    startPipeline();

    // Scan Line Loop
    Animated.loop(
      Animated.timing(scanAnim, {
        toValue: 1,
        duration: 2500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Rotation Loop
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // ── Visual stepper animation ───────────────────────────────────────────────
    const progressTimer = setInterval(() => {
      setSteps((prevSteps) => {
        const nextSteps = [...prevSteps];
        const activeStep = nextSteps[activeStepIndexRef.current];

        if (activeStep && activeStep.status === "active") {
          const currentProgress = activeStep.progress ?? 0;

          if (activeStep.id === 5) {
            // Hold final step at 90% until real WebSocket COMPLETED event arrives
            if (currentProgress < 90) {
              activeStep.progress = Math.min(currentProgress + 10, 90);
            }
          } else {
            if (currentProgress < 100) {
              activeStep.progress = Math.min(currentProgress + 20, 100);
            } else {
              activeStep.status = "completed";
              activeStepIndexRef.current += 1;
              const nextActive = nextSteps[activeStepIndexRef.current];
              if (nextActive) {
                nextActive.status = "active";
                nextActive.progress = 0;
              }
            }
          }
        }
        return nextSteps;
      });
    }, 600);

    return () => {
      isMounted.current = false;
      clearInterval(progressTimer);
      if (unsubscribeRef.current) unsubscribeRef.current();
      socketService.disconnect();
    };
  }, [navigation, targetUrl]);

  const handleAbort = () => {
    showDialog({
      title: 'Exit Verification?',
      message: 'This verification is processing on our servers. You can safely close the app or return home, and the results will appear under Recent Verifications.',
      buttons: [
        { text: 'Stay', onPress: () => {} },
        { text: 'Go Home', onPress: () => navigation.navigate("Main") },
      ],
    });
  };


  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 60 }}
      className="bg-background px-6 pt-16"
    >
      {/* Hidden WebView fallback — only mounts when fast fetch extraction fails */}
      {instagramState?.isExtracting && (
        <WebViewExtractor
          reelUrl={targetUrl}
          onUrlExtracted={handleUrlExtracted}
          onError={handleExtractionError}
        />
      )}



      {/* Header */}

      <View className="items-center text-center mb-8">
        <View className="bg-secondary/10 border border-secondary/20 px-4 py-1.5 rounded-full mb-3">
          <Text className="text-gold font-mono text-[10px] uppercase tracking-widest">
            Neural Analysis Active
          </Text>
        </View>
        <Text className="text-text font-headline text-2xl font-bold text-center">
          Analyzing Social Feed
        </Text>
        <Text className="text-text-muted font-body text-xs text-center mt-1.5 opacity-80">
          Source Link:{" "}
          {targetUrl.length > 36
            ? targetUrl.substring(0, 36) + "..."
            : targetUrl}
        </Text>
      </View>

      {/* High-tech Scanner Visual Box */}
      <View
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        className="w-full h-44 rounded-3xl border-2 border-border items-center justify-center relative overflow-hidden mb-8 bg-surface"
      >
        {/* Subtle grid lines background */}
        <View className="absolute inset-0 flex-row justify-around opacity-20">
          <View className="w-[1px] h-full bg-border/10" />
          <View className="w-[1px] h-full bg-border/10" />
          <View className="w-[1px] h-full bg-border/10" />
          <View className="w-[1px] h-full bg-border/10" />
        </View>
        <View className="absolute inset-0 flex-col justify-around opacity-20">
          <View className="h-[1px] w-full bg-border/10" />
          <View className="h-[1px] w-full bg-border/10" />
          <View className="h-[1px] w-full bg-border/10" />
        </View>

        {/* Ambient background glow */}
        <View
          className="absolute w-44 h-44 rounded-full blur-[40px] opacity-15"
          style={{ backgroundColor: colors.primary }}
        />

        {/* Central Pulsing/Rotating AI Scanner */}
        <View className="w-24 h-24 rounded-full border border-primary/20 items-center justify-center relative bg-surface-low shadow-inner">
          <Animated.View 
            className="absolute w-20 h-20 rounded-full border-t border-b border-primary/40"
            style={{
              transform: [{
                rotate: rotateAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '360deg']
                })
              }]
            }}
          />
          <Animated.View 
            className="absolute w-14 h-14 rounded-full border-l border-r border-gold/40"
            style={{
              transform: [{
                rotate: rotateAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['360deg', '0deg']
                })
              }]
            }}
          />
          <MaterialIcons name="psychology" size={34} color={colors.primary} />
        </View>

        {/* Full-width Sweeping Scan Bar Overlay */}
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 120,
            backgroundColor: 'rgba(56, 189, 248, 0.04)',
            borderRightWidth: 1.5,
            borderRightColor: colors.primary,
            transform: [{
              translateX: scanAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-120, containerWidth + 20]
              })
            }]
          }}
        />
      </View>

      {/* Pipeline steps */}
      <View>
        {steps.map((step) => {
          const isActive = step.status === "active";
          const isCompleted = step.status === "completed";

          return (
            <View
              key={step.id}
              className={`flex-row items-center justify-between p-4 rounded-3xl border-2 mb-5 ${
                isActive 
                  ? 'border-primary bg-surface opacity-100' 
                  : isCompleted 
                    ? 'border-border bg-surface/50 opacity-80' 
                    : 'border-border/30 bg-surface/20 opacity-40'
              }`}
            >
              <View className="flex-row items-center flex-1">
                <View
                  className={`w-12 h-12 rounded-full items-center justify-center mr-5 ${isActive ? 'bg-primary/20' : 'bg-surface-low'}`}
                >
                  {isCompleted ? (
                    <MaterialIcons
                      name="check"
                      size={24}
                      color={colors.primary}
                    />
                  ) : isActive ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <MaterialIcons
                      name="fiber-manual-record"
                      size={14}
                      color={colors.text.outline}
                    />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-text font-headline text-[16px] font-bold">
                    {step.title}
                  </Text>
                  <Text className="text-text-muted font-body text-[13px] mt-1">
                    {step.subtitle}
                  </Text>
                </View>
              </View>
              {isActive && (
                <Text className="text-primary font-mono text-[13px] font-bold">
                  {step.progress}%
                </Text>
              )}
            </View>
          );
        })}
      </View>

      {/* Action buttons */}
      <View className="mt-10 items-center gap-3">
        {/* Move to Home Screen — shown after transcription (step 2) completes */}
        {canCloseApp && (
          <TouchableOpacity
            className="h-14 w-full rounded-full border border-primary/30 bg-primary/15 px-6 justify-center items-center flex-row"
            activeOpacity={0.8}
            onPress={() => navigation.navigate("Main")}
          >
            <MaterialIcons
              name="home"
              size={20}
              color={colors.primary}
              style={{ marginRight: 8 }}
            />
            <Text className="text-primary font-headline text-sm font-bold uppercase tracking-wider">
              Move to Home Screen
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          className="h-14 w-full rounded-full border border-border/10 bg-surface/40 px-12 justify-center items-center flex-row"
          activeOpacity={0.8}
          onPress={handleAbort}
        >
          <MaterialIcons
            name="exit-to-app"
            size={20}
            color={colors.text.outline}
            style={{ marginRight: 8 }}
          />
          <Text className="text-text-muted font-headline text-sm font-bold uppercase tracking-wider">
            Exit Processing
          </Text>
        </TouchableOpacity>

        <Text className="text-text-outline font-mono text-[9px] mt-2 text-center uppercase tracking-widest opacity-60">
          AI engine processes on our servers — check Recent Verifications later
        </Text>
      </View>
    </ScrollView>
  );
}
