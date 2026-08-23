import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Linking, Modal, TextInput, Image } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, FactCheckLog, Claim } from '@/types';
import { colors } from '@/theme/colors';
import { factCheckApi, billingApi } from '@/services/api.service';
import { authService } from '@/services/auth.service';
import { MaterialIcons } from '@expo/vector-icons';
import { useToast } from '@/hooks/useToast';
import { useColorScheme } from 'nativewind';
import { Button } from '@/components/Button';
import { ResultScreenSkeleton } from '@/components/Skeleton';
import { cleanErrorMessage } from '@/utils/errors';
import { getClaimVerdictConfig, getSomiqLabel } from '@/utils/labels';
import * as Haptics from 'expo-haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ResultRouteProp = RouteProp<RootStackParamList, 'Result'>;

export default function ResultScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { colorScheme } = useColorScheme();
  const route = useRoute<ResultRouteProp>();
  const { factCheckId } = route.params;
  
  const { showToast } = useToast();

  const [log, setLog] = useState<FactCheckLog | null>(null);
  const [loading, setLoading] = useState(true);
  type TabType = 'summary' | 'claims' | 'transcript' | 'sources';
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [expandedClaims, setExpandedClaims] = useState<Record<number, boolean>>({});
  const [transcriptLanguage, setTranscriptLanguage] = useState<'original' | 'english'>('original');
  const [isPro, setIsPro] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [refining, setRefining] = useState(false);
  const [resultLanguage, setResultLanguage] = useState<'original' | 'english'>('english');
  
  // Custom revision request modal states
  const [isRevisionModalVisible, setIsRevisionModalVisible] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [submittingRevision, setSubmittingRevision] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    async function fetchResultAndTier() {
      try {
        console.log('[Result] Fetching fact-check results for ID:', factCheckId);
        const res = await factCheckApi.getById(factCheckId);
        if (isCurrent) {
          setLog(res.data);
        }

        // Fetch active user tier status
        try {
          // Fast check: read from local session storage first
          const localUser = await authService.getUser();
          if (isCurrent && localUser && localUser.tier) {
            setIsPro(localUser.tier === 'PRO');
            setIsPremium(localUser.tier === 'PREMIUM');
          }

          // Fresh status from backend
          const billingRes = await billingApi.getStatus();
          if (isCurrent && billingRes.data && billingRes.data.tier) {
            const freshTier = billingRes.data.tier;
            setIsPro(freshTier === 'PRO');
            setIsPremium(freshTier === 'PREMIUM');

            // Sync fresh tier back to local user session if changed
            if (localUser && localUser.tier !== freshTier) {
              const currentToken = await authService.getToken();
              if (currentToken) {
                await authService.saveSession({
                  token: currentToken,
                  user: { ...localUser, tier: freshTier },
                  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                });
              }
            }
          }
        } catch (billingErr) {
          console.log('[Result] Failed to fetch active tier status, defaulting to local/FREE:', billingErr);
        }
      } catch (err) {
        console.error('[Result] Failed to load fact-check:', err);
        showToast({
          title: 'Load Error',
          message: 'Could not retrieve fact-check analysis from server.',
          type: 'error'
        });
      } finally {
        setLoading(false);
      }
    }
    fetchResultAndTier();
    return () => {
      isCurrent = false;
    };
  }, [factCheckId]);

  const handleDeepRefine = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const isFailed = log?.status === 'FAILED';
    const hasPremiumAccess = isPro || isPremium || isFailed;
    if (!hasPremiumAccess) {
      showToast({
        title: 'Premium Upgrade Required',
        message: 'Deep Refine Verdict is exclusive to Premium and Pro tiers.',
        type: 'info'
      });
      navigation.navigate('Paywall');
      return;
    }

    setRefining(true);
    try {
      console.log('[Result] Triggering deep refinement/retry for log:', factCheckId);
      await factCheckApi.retryVerification(factCheckId);
      
      showToast({
        title: 'Execution Queued',
        message: isFailed ? 'Retrying verification...' : 'Deep refining verdict...',
        type: 'success'
      });

      // Navigate to Processing screen with factCheckId and isRefining flag set
      navigation.replace('Processing', {
        factCheckId: log?.id,
        url: log?.videoUrl,
        isRefining: log?.status === 'COMPLETED'
      });
    } catch (err: any) {
      console.error('[Result] Failed to start refinement:', err);
      const errMsg = cleanErrorMessage(
        err.response?.data?.message,
        'Could not initiate Deep Refine.'
      );
      showToast({
        title: 'Execution Error',
        message: errMsg,
        type: 'error'
      });
    } finally {
      setRefining(false);
    }
  };

  const handleRequestRevision = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!isPro) {
      showToast({
        title: 'Pro Feature',
        message: 'Manual Revision is exclusive to the Pro tier. Free and Premium users can submit disputes via the support page on our website.',
        type: 'info'
      });
      return;
    }
    setIsRevisionModalVisible(true);
  };

  const handleDownloadPdf = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!isPro) {
      showToast({
        title: 'Pro Feature',
        message: 'PDF Report export is exclusive to the Pro tier. Please upgrade to Pro.',
        type: 'info'
      });
      navigation.navigate('Paywall'); // Redirect to paywall/billing upgrade settings
      return;
    }

    setDownloadingPdf(true);
    try {
      console.log('[Result] Requesting PDF report generation...');
      const res = await factCheckApi.getPdfReport(factCheckId);
      if (res.data && res.data.downloadUrl) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast({
          title: 'Report Compiled',
          message: 'Opening PDF report...',
          type: 'success'
        });
        await Linking.openURL(res.data.downloadUrl);
      }
    } catch (err: any) {
      console.error('[Result] Failed to generate PDF report:', err);
      const errMsg = cleanErrorMessage(
        err.response?.data?.message,
        'Could not generate PDF report.'
      );
      showToast({
        title: 'Export Failed',
        message: errMsg,
        type: 'error'
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return <ResultScreenSkeleton />;
  }

  if (!log) {
    return (
      <View className="flex-1 bg-background justify-center items-center px-6">
        <MaterialIcons name="warning" size={40} color={colors.text.muted} />
        <Text className="text-text font-headline text-lg font-bold mt-4 text-center">Report Not Found</Text>
        <Text className="text-text-muted font-body text-xs mt-2 text-center">
          The requested fact-check analysis does not exist or you do not have permission to view it.
        </Text>
        <Button
          onPress={() => navigation.navigate('Main')}
          variant="primary"
          size="md"
          className="mt-8"
          title="Return Home"
        />
      </View>
    );
  }

  const isFactual = log.isFactualClaim !== false;
  const claims = log.verificationResult?.claims || [];
  const localizedClaims = log.verificationResult?.localizedClaims || [];
  
  // Calculate average confidence score safely
  const avgConfidence = claims.length > 0
    ? Math.round(claims.reduce((acc, c) => acc + (c.confidence <= 1 ? c.confidence * 100 : c.confidence), 0) / claims.length)
    : isFactual ? 85 : 100;

  const verdictLabelInfo = getSomiqLabel(log);
  
  const getOverallIconName = (label: string) => {
    switch (label) {
      case 'Factual': return 'check-circle';
      case 'Misleading': return 'cancel';
      case 'Partially True': return 'warning';
      case 'Inconclusive': return 'help';
      case 'Failed': return 'error';
      case 'Reviewing': return 'hourglass-empty';
      default: return 'help';
    }
  };

  const overallVerdict = {
    text: verdictLabelInfo.label.toUpperCase(),
    bg: verdictLabelInfo.bg,
    border: verdictLabelInfo.border,
    textCol: verdictLabelInfo.color,
    iconName: getOverallIconName(verdictLabelInfo.label) as 'check-circle' | 'cancel' | 'warning' | 'help' | 'error' | 'hourglass-empty',
  };

  const getClaimVerdictBadge = (verdict: string) => {
    const c = getClaimVerdictConfig(verdict);
    return { text: c.text, color: c.color, symbol: c.symbol, iconName: c.iconName };
  };


  return (
    <View className="flex-1 bg-background pt-16 px-6 pb-8">
      {/* Top Header Shell */}
      <View className="flex-row items-center justify-between mb-8">
        <View className="flex-row items-center flex-1 pr-4">
          <TouchableOpacity
            className="w-11 h-11 items-center justify-center rounded-full bg-surface/80 border border-border/10 mr-4 shadow-lg relative overflow-hidden"
            onPress={() => navigation.goBack()}
          >
            <View className="absolute inset-0 bg-primary/5" />
            <MaterialIcons name="arrow-back" size={20} color={colors.text.DEFAULT} />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-text-outline font-mono text-[9px] uppercase tracking-widest">
              Analysis ID: {log.id.slice(-8).toUpperCase()}
            </Text>
            <Text className="text-text font-headline text-[15px] font-bold mt-0.5" numberOfLines={1}>
              {parsedTitleFromUrl(log.videoUrl)}
            </Text>
          </View>
        </View>

        {/* Verdict Badge */}
        <View 
          className="px-4 py-1.5 rounded-full border flex-row items-center"
          style={{ backgroundColor: overallVerdict.bg, borderColor: overallVerdict.border }}
        >
          <MaterialIcons name={overallVerdict.iconName} size={14} color={overallVerdict.textCol} style={{ marginRight: 4 }} />
          <Text 
            className="font-mono text-[10px] font-bold uppercase tracking-wider"
            style={{ color: overallVerdict.textCol }}
          >
            {overallVerdict.text}
          </Text>
        </View>
      </View>

      {/* Segmented Tab Bar */}
      <View className="flex-row bg-surface-inner rounded-full p-1 mb-6 border border-border/5">
        {(['summary', 'claims', 'transcript', 'sources'] as TabType[]).map((tab) => {
          // Disable claims tab if not factual
          if (tab === 'claims' && !isFactual) return null;
          // Disable transcript tab if no transcript
          if (tab === 'transcript' && !log.transcript) return null;
          // Disable sources tab if no sources
          if (tab === 'sources' && (!isFactual || !log.sources || (Array.isArray(log.sources) ? log.sources.length === 0 : Object.keys(log.sources).length === 0))) return null;

          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              className={`flex-1 items-center justify-center py-2.5 rounded-full ${isActive ? 'bg-primary/20' : 'bg-transparent'}`}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab(tab);
              }}
            >
              <Text className={`font-headline text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-primary' : 'text-text-muted'}`}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tab Content Area */}
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>

        {/* Visual Claims Disclaimer — shown when audio-only can't capture visual content */}
        {log.hasVisualClaims && (
          <View
            className="flex-row items-start p-4 rounded-3xl border-2 mb-4"
            style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)', borderColor: '#f59e0b' }}
          >
            <MaterialIcons name="warning" size={20} color="#f59e0b" style={{ marginRight: 8, marginTop: 2 }} />
            <View className="flex-1">
              <Text className="font-headline text-[12px] font-bold uppercase tracking-wider" style={{ color: '#f59e0b' }}>
                Visual Content Detected
              </Text>
              <Text className="font-body text-[12px] mt-1 leading-relaxed" style={{ color: '#d97706' }}>
                This reel references visual elements (graphs, charts, on-screen text) that are not captured in the audio transcript. Verification is based on audio only — visual claims may not be fully assessed.
              </Text>
            </View>
          </View>
        )}

        {activeTab === 'summary' && (
          <View 
            className="rounded-3xl p-5 border-2 border-border relative overflow-hidden shadow-lg bg-surface/80"
          >
            {/* Glow accent */}
            <View className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-primary/10" />
            <View className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-gold/5" />

            <View className="items-center mb-2">
              <View 
                className="w-36 h-36 rounded-full items-center justify-center border-[5px] mb-4 shadow-lg flex-col p-2"
                style={{ borderColor: overallVerdict.textCol, backgroundColor: colors.surface.darkest }}
              >
                {verdictLabelInfo.label === 'Factual' && (
                  <MaterialIcons name="check-circle" size={38} color="#10b981" />
                )}
                {verdictLabelInfo.label === 'Misleading' && (
                  <MaterialIcons name="cancel" size={38} color="#ef4444" />
                )}
                {verdictLabelInfo.label === 'Partially True' && (
                  <MaterialIcons name="warning" size={38} color="#f59e0b" />
                )}
                {verdictLabelInfo.label === 'Inconclusive' && (
                  <MaterialIcons name="help" size={38} color="#9ca3af" />
                )}
                {verdictLabelInfo.label !== 'Factual' && 
                 verdictLabelInfo.label !== 'Misleading' && 
                 verdictLabelInfo.label !== 'Partially True' && 
                 verdictLabelInfo.label !== 'Inconclusive' && (
                  <MaterialIcons name={overallVerdict.iconName} size={38} color={overallVerdict.textCol} />
                )}
                
                <Text 
                  className="font-headline text-[12px] font-extrabold uppercase mt-2 text-center tracking-wider max-w-[110px]"
                  style={{ color: overallVerdict.textCol, lineHeight: 16 }}
                >
                  {overallVerdict.text}
                </Text>
              </View>

              <View 
                className="px-4 py-1.5 rounded-full bg-surface border border-border/10 mb-6 shadow-sm"
              >
                <Text className="text-text-muted font-headline text-[11px] font-bold uppercase tracking-wider">
                  {avgConfidence}% AI Confidence
                </Text>
              </View>

              <View className="w-full mb-4 items-center">
                <View className="flex-row items-center justify-center mb-1">
                  <MaterialIcons name="assignment" size={20} color={colors.text.DEFAULT} style={{ marginRight: 6 }} />
                  <Text className="text-text font-headline text-base font-bold text-center">
                    Executive Summary
                  </Text>
                </View>
                <Text className="text-text-muted font-body text-[13px] mt-2 leading-relaxed text-center px-2">
                  {log.reason || 'No summary statement generated yet.'}
                </Text>
              </View>
            </View>

            <View className="flex-row flex-wrap justify-center gap-2 mt-1">
              <View className="bg-surface-high px-3 py-1.5 rounded-md border border-border/5">
                <Text className="text-text-muted font-mono text-[10px]">
                  {log.webSearchUsed ? 'WEB SOURCE VERIFIED' : 'TRANSCRIPT ONLY ANALYSIS'}
                </Text>
              </View>
              <View className="bg-surface-high px-3 py-1.5 rounded-md border border-border/5">
                <Text className="text-text-muted font-mono text-[10px]">
                  {log.platform} STREAM
                </Text>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'claims' && isFactual && (
          <View>
            {/* Show toggle if user is PRO and localized claims are available */}
            {isPro && localizedClaims.length > 0 && (
              <View className="flex-row bg-surface-inner rounded-full p-1 mb-5 border border-border/5">
                <TouchableOpacity
                  className={`flex-1 items-center justify-center py-2.5 rounded-full ${resultLanguage === 'english' ? 'bg-primary/20' : 'bg-transparent'}`}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setResultLanguage('english');
                  }}
                >
                  <Text className={`font-headline text-[10px] font-bold uppercase tracking-wider ${resultLanguage === 'english' ? 'text-primary' : 'text-text-muted'}`}>English</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`flex-1 items-center justify-center py-2.5 rounded-full ${resultLanguage === 'original' ? 'bg-primary/20' : 'bg-transparent'}`}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setResultLanguage('original');
                  }}
                >
                  <Text className={`font-headline text-[10px] font-bold uppercase tracking-wider ${resultLanguage === 'original' ? 'text-primary' : 'text-text-muted'}`}>Original</Text>
                </TouchableOpacity>
              </View>
            )}

            {claims.map((claimObj: Claim, idx: number) => {
              const badge = getClaimVerdictBadge(claimObj.verdict);
              const showOriginal = isPro && resultLanguage === 'original' && localizedClaims.length > 0;
              const claimText = showOriginal ? (localizedClaims[idx]?.localizedClaim || claimObj.claim) : claimObj.claim;
              const claimReason = showOriginal ? (localizedClaims[idx]?.localizedReason || claimObj.reason) : claimObj.reason;
              const isExpanded = !!expandedClaims[idx];

              return (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.9}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setExpandedClaims(prev => ({ ...prev, [idx]: !prev[idx] }));
                  }}
                  className={`flex-row items-start p-5 rounded-3xl border-2 mb-5 ${
                    claimObj.usedReasoningModel 
                      ? 'border-purple-500/30 bg-purple-500/5 shadow-md shadow-purple-500/10' 
                      : 'border-border bg-background/40'
                  }`}
                >
                  <Text className="font-mono text-sm pt-0.5 mr-4" style={{ color: badge.color }}>
                    0{idx + 1}
                  </Text>
                  <View className="flex-1 mr-4">
                    {/* Claim Metadata Badges */}
                    <View className="flex-row items-center mb-2 flex-wrap gap-2">
                      {claimObj.usedReasoningModel && (
                        <View
                          className="flex-row items-center px-2 py-0.5 rounded"
                          style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)', borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.3)' }}
                        >
                          <Text className="font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: '#8b5cf6' }}>
                            ✦ PRO DEEP ANALYSIS
                          </Text>
                        </View>
                      )}
                      <View
                        className="flex-row items-center px-2 py-0.5 rounded"
                        style={{ backgroundColor: `${badge.color}15`, borderWidth: 1, borderColor: `${badge.color}30` }}
                      >
                        <Text className="font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: badge.color }}>
                          {badge.text}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-text font-headline text-[16px] font-bold">
                      {claimText}
                    </Text>

                    {isExpanded && (
                      <View className="mt-3 border-t border-border/10 pt-3">
                        <Text className="text-text-muted font-body text-[13px] leading-normal">
                          {claimReason}
                        </Text>
                        <Text className="text-text-outline font-mono text-[10px] mt-3 uppercase tracking-wider">
                          CONFIDENCE: {Math.round(claimObj.confidence <= 1 ? claimObj.confidence * 100 : claimObj.confidence)}%
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  <View className="flex-col items-center justify-center self-center" style={{ gap: 8 }}>
                    <MaterialIcons name={badge.iconName} size={24} color={badge.color} />
                    <MaterialIcons 
                      name={isExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
                      size={18} 
                      color={colors.text.outline} 
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {activeTab === 'transcript' && log.transcript && (
          <View 
            className="rounded-3xl p-5 border-2 border-border shadow-lg bg-surface/80 relative overflow-hidden"
          >
            <View className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-primary/10" />
            {isPro && log.englishTranscript && (
              <View className="flex-row bg-surface-inner rounded-full p-1 mb-4 border border-border/5">
                <TouchableOpacity
                  className={`flex-1 items-center justify-center py-2 rounded-full ${transcriptLanguage === 'original' ? 'bg-primary/20' : 'bg-transparent'}`}
                  onPress={() => setTranscriptLanguage('original')}
                >
                  <Text className={`font-headline text-xs font-bold uppercase tracking-wider ${transcriptLanguage === 'original' ? 'text-primary' : 'text-text-muted'}`}>Original</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`flex-1 items-center justify-center py-2 rounded-full ${transcriptLanguage === 'english' ? 'bg-primary/20' : 'bg-transparent'}`}
                  onPress={() => setTranscriptLanguage('english')}
                >
                  <Text className={`font-headline text-xs font-bold uppercase tracking-wider ${transcriptLanguage === 'english' ? 'text-primary' : 'text-text-muted'}`}>English</Text>
                </TouchableOpacity>
              </View>
            )}
            <View className="p-4 rounded-3xl bg-surface-inner border-2 border-border">
              <Text className="text-text-muted font-body text-xs leading-relaxed">
                "{(!isPro || transcriptLanguage === 'english') && log.englishTranscript ? log.englishTranscript : log.transcript}"
              </Text>
            </View>
          </View>
        )}

        {activeTab === 'sources' && isFactual && log.sources && (Array.isArray(log.sources) ? log.sources.length > 0 : Object.keys(log.sources).length > 0) && (
          <View>
            {(log.sources as string[]).map((src: string, index: number) => {
              const getDomainName = (url: string) => {
                try {
                  return url.replace('https://', '').replace('http://', '').split('/')[0];
                } catch {
                  return '';
                }
              };
              const domain = getDomainName(src);
              const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : '';

              return (
                <TouchableOpacity 
                  key={index}
                  className="rounded-3xl overflow-hidden border-2 border-border bg-surface-inner mb-5"
                  onPress={() => {
                    if (src.startsWith('http')) {
                      Linking.openURL(src).catch(() => {});
                    }
                  }}
                >
                  <View className="p-5">
                    <View className="flex-row justify-between items-center mb-3">
                      <View className="flex-row items-center" style={{ gap: 8 }}>
                        {faviconUrl ? (
                          <Image 
                            source={{ uri: faviconUrl }} 
                            className="w-5 h-5 rounded bg-white border border-border/10" 
                            style={{ width: 18, height: 18 }}
                            resizeMode="contain" 
                          />
                        ) : (
                          <MaterialIcons name="language" size={16} color={colors.primary} />
                        )}
                        <Text className="text-primary font-mono text-[10px] uppercase bg-primary/10 px-2 py-0.5 rounded">Source 0{index + 1}</Text>
                      </View>
                      <Text className="text-text-outline font-mono text-[10px]">ONLINE CITATION</Text>
                    </View>
                    <Text className="text-text font-headline text-[14px] font-semibold" numberOfLines={1}>
                      {domain || src}
                    </Text>
                    <Text className="text-text-muted font-body text-[11px] mt-1" numberOfLines={1}>
                      {src}
                    </Text>
                    <Text className="text-primary font-body text-[12px] mt-3 font-semibold">
                      Open Source Link →
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

          {!isFactual && activeTab !== 'summary' && activeTab !== 'transcript' && (
            <View 
              className="rounded-3xl p-6 border-2 border-border items-center shadow-lg bg-surface/40"
            >
            <MaterialIcons name="campaign" size={32} color={colors.primary} style={{ marginBottom: 8 }} />
            <Text className="text-text font-headline text-base font-bold text-center">Opinion/Non-Factual Content</Text>
            <Text className="text-text-muted font-body text-xs text-center mt-2 leading-relaxed">
              The AI preflight classifier determined that this video is primarily subjective (e.g. opinion, music, entertainment) rather than presenting concrete checkable factual assertions.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Deep Refine / Retry Action */}
      {(log.status === 'COMPLETED' || log.status === 'FAILED') && (
        <View className="mb-4">
          <Button
            onPress={handleDeepRefine}
            disabled={refining}
            loading={refining}
            variant={(isPro || isPremium || log.status === 'FAILED') ? 'primary' : 'secondary'}
            size="md"
            icon={
              <MaterialIcons
                name={log.status === 'FAILED' ? "refresh" : ((isPro || isPremium) ? "psychology" : "lock")}
                size={20}
                color={(isPro || isPremium || log.status === 'FAILED') ? (colorScheme === 'dark' ? colors.background : '#1A1A1A') : colors.primary}
              />
            }
            rightIcon={
              (!(isPro || isPremium) && log.status !== 'FAILED') ? (
                <Text 
                  className="text-[10px] font-mono font-bold uppercase tracking-widest bg-gold/15 px-1.5 py-0.5 rounded"
                  style={{ color: colors.gold, borderColor: colors.gold + '30', borderWidth: 0.5 }}
                >
                  Premium
                </Text>
              ) : undefined
            }
            title={log.status === 'FAILED' ? 'Retry Verification' : 'Deep Refine Verdict'}
          />
        </View>
      )}

      {/* FAB Actions (Fixed at Bottom) */}
      <View className="mt-4" style={{ gap: 10 }}>
        <View className="flex-row justify-between items-center" style={{ gap: 12 }}>
          <Button
            variant="secondary"
            onPress={handleRequestRevision}
            title="Request Revision"
            size="sm"
            className="flex-1"
            icon={!isPro ? <MaterialIcons name="lock" size={14} color={colors.text.outline} /> : undefined}
          />

          <Button
            variant="primary"
            onPress={handleDownloadPdf}
            title="Export PDF Report"
            loading={downloadingPdf}
            disabled={downloadingPdf}
            size="sm"
            className="flex-1"
            icon={!isPro ? <MaterialIcons name="lock" size={14} color={colorScheme === 'dark' ? colors.background : '#1A1A1A'} /> : undefined}
          />
        </View>
      </View>

      {/* Custom Request Revision Modal */}
      <Modal
        visible={isRevisionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsRevisionModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-center items-center px-6">
          <View className="w-full rounded-3xl p-6 border-2 border-border bg-surface shadow-lg">
            <Text className="text-text font-headline text-lg font-bold mb-2">Request Revision</Text>
            <Text className="text-text-muted font-body text-xs mb-4">
              Why do you think the AI verdict is incorrect? You can optionally add context or details below:
            </Text>
            
            <TextInput
              className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 text-text font-body text-sm mb-6"
              placeholder="Explain the context or reason... (optional)"
              placeholderTextColor="#9ca3af"
              value={revisionNotes}
              onChangeText={setRevisionNotes}
              multiline
              numberOfLines={4}
              style={{ minHeight: 85, textAlignVertical: 'top' }}
            />
            
            <View className="flex-row justify-end" style={{ gap: 12 }}>
              <Button
                onPress={() => setIsRevisionModalVisible(false)}
                disabled={submittingRevision}
                variant="outline"
                size="sm"
                title="Cancel"
              />
              
              <Button
                onPress={async () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setSubmittingRevision(true);
                  try {
                    const res = await factCheckApi.requestRevision(factCheckId, revisionNotes);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    showToast({
                      title: 'Revision Request',
                      message: res.data.message || 'Your request has been queued for human validator review.',
                      type: 'success'
                    });
                    setIsRevisionModalVisible(false);
                    setRevisionNotes('');
                  } catch (err: any) {
                    console.error('[Result] Failed to request revision:', err);
                    const errMsg = cleanErrorMessage(
                      err.response?.data?.message,
                      'Could not submit revision request.'
                    );
                    showToast({
                      title: 'Request Failed',
                      message: errMsg,
                      type: 'error'
                    });
                  } finally {
                    setSubmittingRevision(false);
                  }
                }}
                disabled={submittingRevision}
                loading={submittingRevision}
                variant="primary"
                size="sm"
                title="Submit"
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function parsedTitleFromUrl(url: string): string {
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'YouTube Video Verification';
  } else if (url.includes('instagram.com')) {
    return 'Instagram Reel Verification';
  }
  return 'Video Statement Verification';
}
