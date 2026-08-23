import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, Linking, RefreshControl, FlatList } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Button } from '@/components/Button';
import { TactileTouchable } from '@/components/TactileTouchable';
import { HistoryCardSkeleton } from '@/components/Skeleton';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, FactCheckLog } from '@/types';
import { colors } from '@/theme/colors';
import { factCheckApi } from '@/services/api.service';
import { MaterialIcons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { useToast } from '@/hooks/useToast';
import { cleanErrorMessage } from '@/utils/errors';
import { useColorScheme } from 'nativewind';
import { getSomiqLabel } from '@/utils/labels';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const FILTERS = [
  { key: 'ALL', label: 'All', icon: 'apps' },
  { key: 'INSTAGRAM', label: 'Instagram', icon: 'instagram' },
  { key: 'YOUTUBE', label: 'YouTube', icon: 'youtube' },
  { key: 'LOCAL', label: 'Local', icon: 'folder-outline' },
  { key: 'FAILED', label: 'Failed', icon: 'error-outline' },
];

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

export default function HistoryScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [history, setHistory] = useState<FactCheckLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [filterType, setFilterType] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Stats state
  const [stats, setStats] = useState({
    total: 0,
    factual: 0,
    misleading: 0,
    partiallyTrue: 0,
    opinion: 0,
  });

  const { showToast, showDialog } = useToast();

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<FactCheckLog | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [retryingIds, setRetryingIds] = useState<Record<string, boolean>>({});

  const loadStats = async () => {
    try {
      const res = await factCheckApi.getVaultStats();
      if (res.data) {
        setStats({
          total: res.data.total,
          factual: res.data.factual,
          misleading: res.data.misleading,
          partiallyTrue: res.data.partiallyTrue,
          opinion: res.data.opinion,
        });
      }
    } catch (err) {
      console.error('[History] Failed to load vault stats:', err);
    }
  };

  const loadHistory = async (targetPage = 1, currentFilter = filterType, currentSearch = searchQuery) => {
    try {
      setLoading(true);
      
      let platformParam: string | undefined;
      let statusParam: string | undefined;
      let isLocalParam: boolean | undefined;

      if (currentFilter === 'INSTAGRAM') {
        platformParam = 'INSTAGRAM';
      } else if (currentFilter === 'YOUTUBE') {
        platformParam = 'YOUTUBE';
      } else if (currentFilter === 'LOCAL') {
        isLocalParam = true;
      } else if (currentFilter === 'FAILED') {
        statusParam = 'FAILED';
      }

      const res = await factCheckApi.getHistory(targetPage, 10, {
        platform: platformParam,
        status: statusParam,
        isLocal: isLocalParam,
        search: currentSearch || undefined
      });

      if (res.data) {
        setHistory(res.data.items || []);
        setPage(res.data.pagination.page);
        setTotalPages(res.data.pagination.totalPages);
        setTotalItems(res.data.pagination.total);
      }
    } catch (err) {
      console.error('[History] Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRetryFailed = async (item: FactCheckLog) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRetryingIds(prev => ({ ...prev, [item.id]: true }));
    try {
      await factCheckApi.retryVerification(item.id);
      showToast({
        title: 'Retry Started',
        message: 'Re-running verification...',
        type: 'success'
      });
      navigation.navigate('Processing', {
        factCheckId: item.id,
        url: item.videoUrl,
        isRefining: false
      });
    } catch (err: any) {
      console.error('[History] Failed to retry failed check:', err);
      const errMsg = cleanErrorMessage(
        err.response?.data?.message,
        'Could not initiate retry.'
      );
      showToast({
        title: 'Retry Failed',
        message: errMsg,
        type: 'error'
      });
    } finally {
      setRetryingIds(prev => ({ ...prev, [item.id]: false }));
    }
  };

  const handleEditStart = (item: FactCheckLog) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingItem(item);
    setEditTitle(item.title || item.reason || '');
    setIsEditModalVisible(true);
  };

  const handleEditSave = async () => {
    if (!editingItem) return;
    if (!editTitle.trim()) {
      showToast({ title: 'Error', message: 'Title cannot be empty', type: 'error' });
      return;
    }
    try {
      setSavingEdit(true);
      await factCheckApi.updateLog(editingItem.id, editTitle);
      setHistory(prev => prev.map(item => item.id === editingItem.id ? { ...item, title: editTitle } : item));
      setIsEditModalVisible(false);
      setEditingItem(null);
      setEditTitle('');
      showToast({ title: 'Success', message: 'Title updated successfully', type: 'success' });
    } catch (err) {
      console.error('[History] Failed to update title:', err);
      showToast({ title: 'Error', message: 'Failed to update title', type: 'error' });
    } finally {
      setSavingEdit(false);
    }
  };

  const onRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRefreshing(true);
    await Promise.all([
      loadHistory(1, filterType, searchQuery),
      loadStats()
    ]);
    setRefreshing(false);
  };

  // Trigger loading when filters or search query changes
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      setPage(1);
      loadHistory(1, filterType, searchQuery);
      loadStats();
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [filterType, searchQuery]);

  useFocusEffect(
    React.useCallback(() => {
      loadStats();
      loadHistory(page, filterType, searchQuery);
    }, [page])
  );

  const handleSelectItem = (item: FactCheckLog) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (item.status === 'COMPLETED') {
      navigation.navigate('Result', { factCheckId: item.id });
    } else if (item.status === 'FAILED') {
      navigation.navigate('Processing', { url: item.videoUrl });
    } else {
      showToast({ title: "Processing", message: "This item is still processing.", type: "info" });
    }
  };

  const handleDeleteItem = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showDialog({
      title: 'Delete Verification',
      message: 'Are you sure you want to permanently delete this verification from your vault?',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await factCheckApi.deleteLog(id);
              showToast({ title: 'Deleted', message: 'Verification successfully deleted.', type: 'success' });
              
              const newItemsCount = history.length - 1;
              const targetPage = (newItemsCount === 0 && page > 1) ? page - 1 : page;
              loadHistory(targetPage);
              loadStats();
            } catch (err) {
              console.error('[History] Failed to delete log:', err);
              showToast({ title: 'Error', message: 'Failed to delete verification.', type: 'error' });
            }
          }
        }
      ]
    });
  };

  const getVerdictLabelAndColor = (log: FactCheckLog) => {
    const v = getSomiqLabel(log);
    return { text: v.label.toUpperCase(), color: v.color, bg: v.bg, border: v.border };
  };

  const renderItem = ({ item }: { item: FactCheckLog }) => {
    const badge = getVerdictLabelAndColor(item);
    const dateStr = new Date(item.createdAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timeStr = new Date(item.createdAt).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    let platformBg = 'bg-surface-low';
    let iconColor = colors.text.muted;
    
    if (item.platform === 'YOUTUBE') {
      platformBg = 'bg-red-600';
      iconColor = '#FFFFFF';
    } else if (item.platform === 'INSTAGRAM') {
      platformBg = 'bg-pink-600';
      iconColor = '#FFFFFF';
    } else if (item.platform === 'TIKTOK') {
      platformBg = 'bg-black';
      iconColor = '#FFFFFF';
    } else if (item.platform === 'LOCAL_VIDEO') {
      platformBg = 'bg-blue-600';
      iconColor = '#FFFFFF';
    } else if (item.platform === 'LOCAL_IMAGE') {
      platformBg = 'bg-amber-500';
      iconColor = '#FFFFFF';
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
        key={item.id}
        className="rounded-3xl p-6 border border-border/10 bg-surface/60 shadow-md mb-5 flex-col overflow-hidden relative"
        scaleTo={0.96}
        onPress={() => handleSelectItem(item)}
      >
        {/* Left Side Status Edge Indicator */}
        <View 
          className="absolute left-0 top-0 bottom-0 w-[5px]" 
          style={{ backgroundColor: badge.color }} 
        />

        {/* Soft ambient background spotlight glows */}
        <View 
          className="absolute -left-12 -top-12 w-48 h-48 rounded-full opacity-[0.04]" 
          style={{ backgroundColor: badge.color }} 
        />
        <View 
          className="absolute -right-8 -bottom-8 w-36 h-36 rounded-full opacity-[0.03]" 
          style={{ backgroundColor: badge.color }} 
        />

        {/* Faint watermark Platform/Verdict Icon rotated behind card */}
        <View 
          className="absolute right-[-20px] bottom-[-10px] opacity-[0.03]" 
          style={{ transform: [{ rotate: '12deg' }] }}
        >
          {badge.text === 'FACTUAL' ? (
            <MaterialIcons name="check-circle" size={110} color={badge.color} />
          ) : badge.text === 'PARTIALLY TRUE' ? (
            <MaterialCommunityIcons name="alert-circle" size={110} color={badge.color} />
          ) : badge.text === 'FAILED' ? (
            <MaterialIcons name="error" size={110} color={badge.color} />
          ) : (
            <MaterialCommunityIcons name="close-circle" size={110} color={badge.color} />
          )}
        </View>

        {/* Top Row: Platform Icon + Date/Time + Verdict Badge */}
        <View className="flex-row justify-between items-center mb-4 pl-1">
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <View className={`w-9 h-9 rounded-xl ${platformBg} items-center justify-center border border-white/5`}>
              {renderPlatformIcon(item.platform, 16, iconColor)}
            </View>
            <Text className="text-text-muted font-body text-[11px] font-semibold">
              {dateStr} • {timeStr}
            </Text>
          </View>

          {/* Verdict Badge */}
          <View 
            className="px-3 py-1 rounded-full border shadow-sm"
            style={{
              backgroundColor: badge.bg,
              borderColor: badge.border
            }}
          >
            <Text 
              className="font-headline text-[10px] font-bold uppercase tracking-wider"
              style={{ color: badge.color }}
            >
              {badge.text}
            </Text>
          </View>
        </View>

        {/* Title Section */}
        <Text className="text-text font-headline text-base font-bold leading-snug mb-2 pl-1" numberOfLines={2}>
          {getVideoTitle(item)}
        </Text>
        
        {/* Audit ID */}
        <Text className="text-text-outline font-mono text-[9px] mb-4 pl-1">
          Audit ID: {item.id.toUpperCase()}
        </Text>

        {/* Divider Line */}
        <View className="h-[1px] bg-border/5 mb-4 ml-1" />

        {/* Bottom Source & Action Row */}
        <View className="flex-row justify-between items-center pl-1">
          {/* Source link badge */}
          {item.videoUrl ? (
            <TouchableOpacity
              onPress={() => {
                Linking.openURL(item.videoUrl).catch(err => {
                  console.error('[History] Failed to open URL:', err);
                  showToast({ title: 'Error', message: 'Could not open video URL.', type: 'error' });
                });
              }}
              className="flex-row items-center max-w-[45%] bg-surface-low px-3 py-1.5 rounded-lg border border-border/5"
              activeOpacity={0.7}
            >
              <MaterialIcons name="link" size={13} color={colors.text.muted} style={{ marginRight: 4 }} />
              <Text className="text-text-muted font-body text-[11px]" numberOfLines={1}>
                Source Link
              </Text>
            </TouchableOpacity>
          ) : (
            <View className="bg-surface-low px-3 py-1.5 rounded-lg border border-border/5">
              <Text className="text-text-disabled font-body text-[11px]">No Source</Text>
            </View>
          )}
          
          {/* Action Buttons */}
          <View className="flex-row items-center" style={{ gap: 8 }}>
            {item.status === 'COMPLETED' && (
              <TouchableOpacity 
                onPress={() => handleEditStart(item)}
                className="w-9 h-9 rounded-full bg-surface-low items-center justify-center border border-border/10"
              >
                <MaterialIcons name="edit" size={15} color={colors.text.muted} />
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              onPress={() => handleDeleteItem(item.id)}
              className="w-9 h-9 rounded-full bg-red-500/5 items-center justify-center border border-red-500/10"
            >
              <MaterialIcons name="delete-outline" size={16} color="#ef4444" />
            </TouchableOpacity>

            {item.status === 'FAILED' ? (
              <TouchableOpacity
                onPress={() => handleRetryFailed(item)}
                disabled={retryingIds[item.id]}
                className="h-9 px-4 rounded-full flex-row items-center justify-center bg-blue-600 shadow-md"
              >
                {retryingIds[item.id] ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text className="font-headline text-[11px] font-bold mr-1 text-white">
                      RETRY
                    </Text>
                    <MaterialIcons name="refresh" size={12} color="#FFFFFF" />
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => handleSelectItem(item)}
                className="h-9 px-4 rounded-full flex-row items-center justify-center bg-blue-600 shadow-md"
              >
                <Text className="font-headline text-[11px] font-bold text-white">
                  View Report
                </Text>
                <MaterialIcons 
                  name="chevron-right" 
                  size={14} 
                  color="#FFFFFF"
                  style={{ marginLeft: 2 }} 
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TactileTouchable>
    );
  };

  const renderHeader = () => (
    <View>
      {/* Header Info */}
      <View className="flex-row justify-between items-start mb-6">
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text 
              className="font-headline text-[28px] font-bold tracking-tight mr-2"
              style={{ color: colors.primary }}
            >
              Cloud Vault
            </Text>
            <MaterialCommunityIcons name="cloud-sync" size={22} color={colors.primary} style={{ marginTop: 6 }} />
          </View>
          <Text className="text-text-muted font-body text-xs mt-1">Your past verification reports</Text>
        </View>
        
        {/* Search Toggle Icon Button */}
        <TouchableOpacity
          onPress={() => {
            setShowSearch(prev => !prev);
            if (showSearch) setSearchQuery(''); // Clear search on collapse
          }}
          className={`w-10 h-10 rounded-full items-center justify-center border border-border/10 bg-surface/60`}
          activeOpacity={0.7}
        >
          <MaterialIcons name={showSearch ? "close" : "search"} size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Expandable Search Input Field */}
      {showSearch && (
        <View className="mb-6 flex-row items-center bg-surface/60 rounded-xl px-4 py-2 border border-border/10">
          <MaterialIcons name="search" size={18} color={colors.text.outline} className="mr-2" />
          <TextInput
            placeholder="Search audits by title, transcript..."
            placeholderTextColor={colors.text.outline}
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 text-text font-body text-xs"
            autoFocus
          />
        </View>
      )}

      {/* Statistics Cards Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 2, paddingBottom: 4 }}
        className="mb-6 max-h-16"
      >
        {/* Total Reports */}
        <View className="p-2 py-2.5 rounded-2xl border border-border/10 bg-surface/40 flex-row items-center w-[130px]">
          <View className="w-8 h-8 rounded-xl bg-blue-500/10 items-center justify-center mr-1.5">
            <MaterialCommunityIcons name="shield-outline" size={16} color="#38bdf8" />
          </View>
          <View className="flex-1">
            <Text className="text-text font-headline text-sm font-bold leading-none mb-0.5">{stats.total}</Text>
            <Text className="text-text-muted text-[8px] font-semibold leading-none" numberOfLines={1}>Total</Text>
          </View>
        </View>

        {/* Factual */}
        <View className="p-2 py-2.5 rounded-2xl border border-border/10 bg-surface/40 flex-row items-center w-[130px]">
          <View className="w-8 h-8 rounded-xl bg-emerald-500/10 items-center justify-center mr-1.5">
            <MaterialIcons name="check-circle-outline" size={16} color="#10b981" />
          </View>
          <View className="flex-1">
            <Text className="text-text font-headline text-sm font-bold leading-none mb-0.5">{stats.factual}</Text>
            <Text className="text-text-muted text-[8px] font-semibold leading-none" numberOfLines={1}>Factual</Text>
          </View>
        </View>

        {/* Partially True */}
        <View className="p-2 py-2.5 rounded-2xl border border-border/10 bg-surface/40 flex-row items-center w-[130px]">
          <View className="w-8 h-8 rounded-xl bg-amber-500/10 items-center justify-center mr-1.5">
            <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#f59e0b" />
          </View>
          <View className="flex-1">
            <Text className="text-text font-headline text-sm font-bold leading-none mb-0.5">{stats.partiallyTrue}</Text>
            <Text className="text-text-muted text-[8px] font-semibold leading-none" numberOfLines={1}>Partial</Text>
          </View>
        </View>

        {/* Misleading */}
        <View className="p-2 py-2.5 rounded-2xl border border-border/10 bg-surface/40 flex-row items-center w-[130px]">
          <View className="w-8 h-8 rounded-xl bg-red-500/10 items-center justify-center mr-1.5">
            <MaterialCommunityIcons name="close-circle-outline" size={16} color="#f43f5e" />
          </View>
          <View className="flex-1">
            <Text className="text-text font-headline text-sm font-bold leading-none mb-0.5">{stats.misleading}</Text>
            <Text className="text-text-muted text-[8px] font-semibold leading-none" numberOfLines={1}>Misleading</Text>
          </View>
        </View>

        {/* Opinion/Context */}
        <View className="p-2 py-2.5 rounded-2xl border border-border/10 bg-surface/40 flex-row items-center w-[130px]">
          <View className="w-8 h-8 rounded-xl bg-yellow-600/10 items-center justify-center mr-1.5">
            <MaterialCommunityIcons name="chat-outline" size={15} color="#d97706" />
          </View>
          <View className="flex-1">
            <Text className="text-text font-headline text-sm font-bold leading-none mb-0.5">{stats.opinion}</Text>
            <Text className="text-text-muted text-[8px] font-semibold leading-none" numberOfLines={1}>Opinion/Context</Text>
          </View>
        </View>
      </ScrollView>

      {/* Filter Bar */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
        className="mb-6 max-h-12"
      >
        {FILTERS.map((f) => {
          const isSelected = filterType === f.key;
          
          let selectedBg = isDark ? 'bg-primary' : 'bg-primary';
          if (isSelected && f.key === 'ALL') {
            selectedBg = 'bg-blue-600'; // All button uses blue background
          }

          const renderFilterIcon = (key: string, color: string) => {
            if (key === 'ALL') {
              return <MaterialCommunityIcons name="apps" size={13} color={color} style={{ marginRight: 6 }} />;
            }
            if (key === 'INSTAGRAM') {
              return <FontAwesome5 name="instagram" size={12} color={color} style={{ marginRight: 6 }} />;
            }
            if (key === 'YOUTUBE') {
              return <FontAwesome5 name="youtube" size={12} color={color} style={{ marginRight: 6 }} />;
            }
            if (key === 'LOCAL') {
              return <MaterialCommunityIcons name="folder-outline" size={13} color={color} style={{ marginRight: 6 }} />;
            }
            return <MaterialIcons name="error-outline" size={13} color={color} style={{ marginRight: 6 }} />;
          };

          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => {
                setFilterType(f.key);
                setPage(1);
              }}
              className={`px-4 py-2.5 rounded-xl border flex-row items-center ${
                isSelected 
                  ? `${selectedBg} border-transparent` 
                  : 'bg-surface/30 border-border/10'
              }`}
              activeOpacity={0.75}
            >
              {renderFilterIcon(f.key, isSelected ? '#FFFFFF' : colors.text.muted)}
              <Text 
                className="text-[11px] font-bold"
                style={{ 
                  color: isSelected 
                    ? '#FFFFFF' 
                    : colors.text.muted 
                }}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Main Content Loading State */}
      {loading && history.length === 0 && (
        <View className="flex-col">
          <HistoryCardSkeleton />
          <HistoryCardSkeleton />
          <HistoryCardSkeleton />
        </View>
      )}
    </View>
  );

  const renderFooter = () => {
    if (loading || totalPages <= 1) return null;
    return (
      <View className="flex-row justify-between items-center mt-8 px-1">
        <TouchableOpacity
          disabled={page <= 1}
          onPress={() => {
            const prevPage = page - 1;
            setPage(prevPage);
          }}
          className={`px-5 py-2.5 rounded-full border flex-row items-center ${
            page <= 1 ? 'opacity-30 border-border/10 bg-transparent' : 'border-primary/30 bg-primary/10'
          }`}
        >
          <MaterialIcons name="chevron-left" size={16} color={page <= 1 ? colors.text.outline : colors.primary} />
          <Text className={`font-headline font-bold text-xs ml-0.5 ${page <= 1 ? 'text-text-outline' : 'text-primary'}`}>Prev</Text>
        </TouchableOpacity>

        <Text className="text-text font-headline text-xs font-semibold">
          Page {page} of {totalPages}
        </Text>

        <TouchableOpacity
          disabled={page >= totalPages}
          onPress={() => {
            const nextPage = page + 1;
            setPage(nextPage);
          }}
          className={`px-5 py-2.5 rounded-full border flex-row items-center ${
            page >= totalPages ? 'opacity-30 border-border/10 bg-transparent' : 'border-primary/30 bg-primary/10'
          }`}
        >
          <Text className={`font-headline font-bold text-xs mr-0.5 ${page >= totalPages ? 'text-text-outline' : 'text-primary'}`}>Next</Text>
          <MaterialIcons name="chevron-right" size={16} color={page >= totalPages ? colors.text.outline : colors.primary} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View className="flex-1 justify-center items-center py-20 border border-dashed border-border/25 rounded-3xl p-6 bg-surface/30">
        <MaterialIcons name="folder-open" size={36} color={colors.text.outline} style={{ marginBottom: 8 }} />
        <Text className="text-text font-headline text-sm font-semibold text-center">No reports found</Text>
        <Text className="text-text-muted font-body text-xs text-center mt-2 leading-relaxed">
          There are no verification logs matching this filter or search query.
        </Text>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-background px-6 pt-16">
      <FlatList
        data={history}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
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
      />

      {/* Edit Title Modal */}
      <Modal
        visible={isEditModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-center items-center px-6">
          <View className="w-full rounded-3xl p-6 border border-border/15 bg-surface shadow-lg">
            <Text className="text-text font-headline text-lg font-bold mb-2">Rename Audit</Text>
            <Text className="text-text-muted font-body text-xs mb-4">
              Enter a new catchy title for this verification log:
            </Text>
            
            <TextInput
              className="w-full bg-background border border-border/20 rounded-xl px-4 py-3 text-text font-body text-sm mb-6"
              placeholder="Enter title..."
              placeholderTextColor="#9ca3af"
              value={editTitle}
              onChangeText={setEditTitle}
              autoFocus
            />
            
            <View className="flex-row justify-end" style={{ gap: 12 }}>
              <Button
                onPress={() => setIsEditModalVisible(false)}
                disabled={savingEdit}
                variant="outline"
                size="sm"
                title="Cancel"
              />
              
              <Button
                onPress={handleEditSave}
                disabled={savingEdit}
                loading={savingEdit}
                variant="primary"
                size="sm"
                title="Save"
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
