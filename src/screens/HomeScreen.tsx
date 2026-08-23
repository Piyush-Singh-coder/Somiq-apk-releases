import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Image,
} from "react-native";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList, FactCheckLog } from "@/types";
import { colors } from "@/theme/colors";
import { MaterialIcons, FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";
import { Button } from "@/components/Button";
import { TactileTouchable } from "@/components/TactileTouchable";
import { HomeCardSkeleton } from "@/components/Skeleton";
import { authService } from "@/services/auth.service";
import { useToast } from "@/hooks/useToast";
import { factCheckApi } from "@/services/api.service";
import { getSomiqLabel } from "@/utils/labels";
import * as Haptics from 'expo-haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function timeAgo(dateString: string | Date) {
  const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return `Just now`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hrs ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

function getVideoTitle(log: FactCheckLog): string {
  if (log.title) {
    return log.title;
  }
  if (log.transcript) {
    const cleanText = log.transcript.replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trim();
    if (cleanText.length > 0) {
      return cleanText.length > 40 ? `${cleanText.substring(0, 37)}...` : cleanText;
    }
  }
  if (log.reason) {
    const cleanReason = log.reason.trim();
    return cleanReason.length > 40 ? `${cleanReason.substring(0, 37)}...` : cleanReason;
  }
  let platformLabel = 'Video';
  if (log.platform === 'YOUTUBE') platformLabel = 'YouTube';
  else if (log.platform === 'INSTAGRAM') platformLabel = 'Instagram';
  else if (log.platform === 'TIKTOK') platformLabel = 'TikTok';
  else if (log.platform === 'LOCAL_VIDEO') platformLabel = 'Local Video';
  else if (log.platform === 'LOCAL_IMAGE') platformLabel = 'Local Image';
  return `${platformLabel} Verification #${log.id.slice(-4).toUpperCase()}`;
}

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const isFocused = useIsFocused();
  const [userName, setUserName] = useState("");
  const [userImage, setUserImage] = useState<string | undefined>(undefined);
  const [history, setHistory] = useState<FactCheckLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const { showToast, showDialog } = useToast();

  useEffect(() => {
    async function loadUser() {
      try {
        const user = await authService.getUser();
        if (user) {
          setUserImage(user.image);
          if (user.name) {
            setUserName(user.name);
          } else if (user.email) {
            setUserName(user.email.split("@")[0]);
          }
        }
      } catch (e) {
        // Keep default
      }
    }
    loadUser();
  }, [isFocused]);

  useEffect(() => {
    if (isFocused) {
      loadHistory();
    }
  }, [isFocused]);

  const loadHistory = async () => {
    try {
      const res = await factCheckApi.getHistory(1, 4); // Fetch 4 items for compact vertical listing
      if (res.data && res.data.items) {
        setHistory(res.data.items);
      }
    } catch (e) {
      console.log('Failed to fetch history:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const onRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };


  return (
    <View className="flex-1 bg-background">
      {/* Top Header Shell */}
      <View className="flex-row justify-between items-center px-6 pt-14 pb-5 bg-background border-b border-border/5">
        <View className="flex-row items-center">
          <View className="w-14 h-14 rounded-full bg-surface-low items-center justify-center overflow-hidden border border-border/10 mr-4 shadow-lg">
            {userImage ? (
              <Image source={{ uri: userImage }} className="w-full h-full" resizeMode="cover" />
            ) : (
              <Text 
                className="font-headline font-bold text-[22px]"
                style={{ color: colors.primary }}
              >
                {userName.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View className="flex-col">
            <Text className="text-[12px] text-text-muted">Welcome back,</Text>
            <Text className="text-[18px] text-text font-bold mt-0.5">{userName}</Text>
          </View>
        </View>
        <View className="w-11 h-11 items-center justify-center rounded-full bg-surface/80 border border-border/10 shadow-lg"
        >
          <MaterialIcons name="auto-awesome" size={20} color={colors.primary} />
        </View>
      </View>

      <ScrollView
        className="flex-1 px-6 pt-6"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 180 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Command Center Card */}
        <View className="rounded-3xl p-6 mb-8 border-2 border-border bg-surface shadow-lg overflow-hidden relative flex-row items-center justify-between">
          {/* Ambient Glow */}
          <View className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-primary/10" />
          <View className="absolute -top-8 -right-8 w-16 h-16 rounded-full bg-primary/10" />
          
          <View className="flex-row items-center flex-1 pr-4">
            <View className="relative mr-4">
              <MaterialIcons name="psychology" size={36} color={colors.primary} />
              <View className="absolute -top-1 -right-1 w-3 h-3 bg-gold rounded-full border border-background" />
            </View>
            <View>
              <Text className="text-text font-headline text-[15px] font-bold mb-1">
                Somiq Command Center
              </Text>
              <Text className="text-text-muted text-[11px] leading-tight">
                Your AI copilot for content verification,{"\n"}insights & decisions.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            className="border border-border/20 rounded-full px-4 py-2 flex-row items-center bg-surface/5"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("Main", { screen: "Verification" });
            }}
            activeOpacity={0.8}
          >
            <Text className="text-text text-[11px] font-bold mr-1">Verify</Text>
            <MaterialIcons name="chevron-right" size={14} color={colors.text.DEFAULT} />
          </TouchableOpacity>
        </View>

        {/* Hero Input Section */}
        <View className="rounded-3xl p-7 mb-10 border-2 border-border bg-surface shadow-2xl relative overflow-hidden">
          {/* Ambient Glow */}
          <View className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-primary/10" />
          <View className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gold/5" />

          <Text className="text-text font-headline text-[28px] font-bold tracking-tight mb-4 leading-tight">
            Verify the <Text style={{ color: colors.primary }} className="italic">truth</Text> instantly.
          </Text>
          <Text className="text-text-muted font-body text-[13px] mb-8 leading-relaxed">
            Paste a YouTube Shorts or Instagram Reels link, or upload a local video or audio file. Our multi-stage AI pipeline transcribes, extracts claims, and cross-references them against trusted sources.
          </Text>

          <Button
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              navigation.navigate("Main", { screen: "Verification" });
            }}
            variant="primary"
            size="md"
            className="w-full"
            icon={<MaterialIcons name="shield" size={18} color={colors.text.DEFAULT} />}
            rightIcon={<MaterialIcons name="arrow-forward" size={16} color={colors.text.DEFAULT} />}
            title="Start Verification"
          />
        </View>

        {/* Recent Verifications (Dynamic History - Redesigned to Vertical) */}
        <View className="mb-10">
          <View className="flex-row justify-between items-center mb-6 px-1">
            <View className="flex-row items-center">
              <MaterialIcons name="show-chart" size={18} color={colors.primary} style={{ marginRight: 8 }} />
              <Text className="text-text font-headline text-[15px] font-bold">Recent Verifications</Text>
            </View>
            <Text className="text-text-muted text-[11px] font-body">Pull down to refresh</Text>
          </View>

          {loadingHistory ? (
            <View className="flex-col">
              <HomeCardSkeleton />
              <HomeCardSkeleton />
            </View>
          ) : history.length === 0 ? (
            <View className="rounded-3xl p-6 border-2 border-border bg-surface/60 items-center justify-center">
              <Text className="text-text-muted text-[13px]">No verifications yet.</Text>
            </View>
          ) : (
            <View className="flex-col">
              {history.map((log) => {
                const verdictInfo = getSomiqLabel(log);
                const statusLabel = verdictInfo.label;
                const statusBadgeClass = `${verdictInfo.bgClass} ${verdictInfo.borderClass}`;
                const statusTextClass = verdictInfo.textClass;

                let platformIconColor = colors.text.outline;
                let platformBgColor = 'bg-border/10';
                
                if (log.platform === 'YOUTUBE') {
                  platformIconColor = '#ef4444';
                  platformBgColor = 'bg-red-500/10';
                } else if (log.platform === 'INSTAGRAM') {
                  platformIconColor = '#f472b6';
                  platformBgColor = 'bg-pink-500/10';
                } else if (log.platform === 'TIKTOK') {
                  platformIconColor = '#25f4ee';
                  platformBgColor = 'bg-cyan-500/10';
                } else if (log.platform === 'LOCAL_VIDEO') {
                  platformIconColor = colors.primary;
                  platformBgColor = 'bg-primary/10';
                } else if (log.platform === 'LOCAL_IMAGE') {
                  platformIconColor = colors.gold;
                  platformBgColor = 'bg-gold/10';
                }

                const renderPlatformIcon = (plat: string, iconSize: number, customColor: string) => {
                  if (plat === 'YOUTUBE') {
                    return <FontAwesome5 name="youtube" size={iconSize} color={customColor} />;
                  }
                  if (plat === 'INSTAGRAM') {
                    return <FontAwesome5 name="instagram" size={iconSize} color={customColor} />;
                  }
                  if (plat === 'TIKTOK') {
                    return <FontAwesome5 name="tiktok" size={iconSize - 2} color={customColor} />;
                  }
                  if (plat === 'LOCAL_VIDEO') {
                    return <MaterialCommunityIcons name="video" size={iconSize + 2} color={customColor} />;
                  }
                  if (plat === 'LOCAL_IMAGE') {
                    return <MaterialCommunityIcons name="image" size={iconSize + 2} color={customColor} />;
                  }
                  return <MaterialIcons name="perm-media" size={iconSize} color={customColor} />;
                };

                return (
                  <TactileTouchable
                    key={log.id}
                    className="flex-row items-center justify-between p-4 rounded-3xl border-2 border-border bg-surface mb-3 shadow-md"
                    scaleTo={0.96}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      if (log.status === 'COMPLETED') {
                        navigation.navigate("Result", { factCheckId: log.id });
                      } else if (log.status === 'FAILED') {
                        navigation.navigate("Processing", { url: log.videoUrl });
                      } else {
                        showToast({ title: "Processing", message: "This item is still processing.", type: "info" });
                      }
                    }}
                  >
                    <View className="flex-row items-center flex-1 pr-3">
                      <View className={`w-12 h-12 rounded-[16px] ${platformBgColor} items-center justify-center mr-4`}>
                        {renderPlatformIcon(log.platform, 20, platformIconColor)}
                      </View>
                      <View className="flex-1">
                        <Text className="text-text font-headline text-[14px] font-bold" numberOfLines={1}>
                          {getVideoTitle(log)}
                        </Text>
                        <Text className="text-text-muted text-[11px] mt-0.5">
                          {log.status === 'COMPLETED' ? 'Completed' : log.status === 'FAILED' ? 'Failed' : 'In Review'} • {timeAgo(log.createdAt)}
                        </Text>
                      </View>
                    </View>

                    <View className={`px-2.5 py-1 rounded-full border ${statusBadgeClass}`}>
                      <Text className={`text-[10px] font-bold ${statusTextClass}`}>
                        {statusLabel}
                      </Text>
                    </View>
                  </TactileTouchable>
                );
              })}

              <Button
                variant="secondary"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("Main", { screen: "History" });
                }}
                title="See All History"
                size="sm"
                className="w-full mt-2"
                rightIcon={<MaterialIcons name="arrow-forward" size={14} color={colors.text.DEFAULT} />}
              />
            </View>
          )}
        </View>

        {/* Verification Labels Guide */}
        <View className="mb-10">
          <View className="flex-row items-center mb-6 px-1">
            <MaterialIcons name="label-important" size={18} color={colors.primary} style={{ marginRight: 8 }} />
            <Text className="text-text font-headline text-[15px] font-bold">Verification Labels Guide</Text>
          </View>
          
          <View className="rounded-3xl p-5 border-2 border-border bg-surface/60">
            <View className="flex-row items-start mb-4">
              <View className="px-2.5 py-1 rounded-full border bg-primary/10 border-primary/20 mr-3 items-center justify-center min-w-[80px]">
                <Text className="text-[10px] font-bold text-primary text-center">Factual</Text>
              </View>
              <View className="flex-1">
                <Text className="text-text font-bold text-xs">Accurate Assertion</Text>
                <Text className="text-text-muted text-[10.5px] mt-0.5 leading-relaxed">The claim matches verified facts from reliable search databases, global records, and scientific journals.</Text>
              </View>
            </View>

            <View className="flex-row items-start mb-4">
              <View className="px-2.5 py-1 rounded-full border bg-red-500/10 border-red-500/20 mr-3 items-center justify-center min-w-[80px]">
                <Text className="text-[10px] font-bold text-red-400 text-center">Misleading</Text>
              </View>
              <View className="flex-1">
                <Text className="text-text font-bold text-xs">False or Manipulated</Text>
                <Text className="text-text-muted text-[10.5px] mt-0.5 leading-relaxed">The claim contains uncorroborated statements, deliberate misinformation, or has been altered from its true context.</Text>
              </View>
            </View>

            <View className="flex-row items-start mb-4">
              <View className="px-2.5 py-1 rounded-full border bg-gold/10 border-gold/20 mr-3 items-center justify-center min-w-[80px]">
                <Text className="text-[10px] font-bold text-gold text-center">Opinion/Context</Text>
              </View>
              <View className="flex-1">
                <Text className="text-text font-bold text-xs">Subjective / Non-Factual</Text>
                <Text className="text-text-muted text-[10.5px] mt-0.5 leading-relaxed">The content represents personal opinion, commentary, satire, cooking, general entertainment, or requires subjective evaluation rather than purely empirical facts.</Text>
              </View>
            </View>

            <View className="flex-row items-start mb-4">
              <View className="px-2.5 py-1 rounded-full border bg-blue-500/10 border-blue-500/20 mr-3 items-center justify-center min-w-[80px]">
                <Text className="text-[10px] font-bold text-blue-400 text-center">Reviewing</Text>
              </View>
              <View className="flex-1">
                <Text className="text-text font-bold text-xs">Audit In Progress</Text>
                <Text className="text-text-muted text-[10.5px] mt-0.5 leading-relaxed">The video is currently being parsed for claims and cross-referenced by our multi-model AI audit fallback chain.</Text>
              </View>
            </View>

            <View className="flex-row items-start mb-4">
              <View className="px-2.5 py-1 rounded-full border bg-amber-500/10 border-amber-500/20 mr-3 items-center justify-center min-w-[80px]">
                <Text className="text-[10px] font-bold text-amber-500 text-center">Partially True</Text>
              </View>
              <View className="flex-1">
                <Text className="text-text font-bold text-xs">Mixed Evidence</Text>
                <Text className="text-text-muted text-[10.5px] mt-0.5 leading-relaxed">Some claims are supported by evidence while others are disputed. The content has elements of truth but contains inaccuracies or missing context.</Text>
              </View>
            </View>

            <View className="flex-row items-start mb-4">
              <View className="px-2.5 py-1 rounded-full border bg-gray-500/10 border-gray-500/20 mr-3 items-center justify-center min-w-[80px]">
                <Text className="text-[10px] font-bold text-gray-400 text-center">Inconclusive</Text>
              </View>
              <View className="flex-1">
                <Text className="text-text font-bold text-xs">Unverifiable Content</Text>
                <Text className="text-text-muted text-[10.5px] mt-0.5 leading-relaxed">The claim lacks sufficient public evidence, is self-contradictory, or cannot be verified using available reference materials.</Text>
              </View>
            </View>

            <View className="flex-row items-start">
              <View className="px-2.5 py-1 rounded-full border bg-red-500/10 border-red-500/20 mr-3 items-center justify-center min-w-[80px]">
                <Text className="text-[10px] font-bold text-red-400 text-center">Failed</Text>
              </View>
              <View className="flex-1">
                <Text className="text-text font-bold text-xs">Validation Error</Text>
                <Text className="text-text-muted text-[10.5px] mt-0.5 leading-relaxed">A connection or processing timeout occurred. Tap the recent verification card to initiate a retry attempt.</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Redirect to Web Card */}
        <View className="rounded-3xl p-6 border-2 border-border bg-surface-low mb-10 overflow-hidden relative">
          <View className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full bg-primary/10" />
          <View className="flex-row items-center mb-3">
            <MaterialIcons name="language" size={24} color={colors.primary} style={{ marginRight: 10 }} />
            <Text className="text-text font-headline text-base font-bold">Detailed Web Platform</Text>
          </View>
          <Text className="text-text-muted text-xs leading-relaxed">
            Our web portal includes complete documentation on how Somiq works, decentralized WebView technology insights, detailed feature breakdowns, and our transparency roadmap.
          </Text>
          <Button
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
              const websiteUrl = backendUrl.includes('localhost') || backendUrl.includes('10.0.2.2')
                ? 'http://localhost:3001'
                : 'https://somiq.veriqlabs.com';
              Linking.openURL(websiteUrl).catch(() => {});
            }}
            variant="primary"
            size="sm"
            className="mt-4 self-start"
            rightIcon={<MaterialIcons name="open-in-new" size={14} color={colors.text.DEFAULT} />}
            title="Open Web Portal"
          />
        </View>

      </ScrollView>
    </View>
  );
}
