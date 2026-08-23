import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Image, Linking, RefreshControl, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, BillingStatus } from '@/types';
import { colors } from '@/theme/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from '@/components/Button';
import * as ImagePicker from 'expo-image-picker';
import { authService } from '@/services/auth.service';
import api, { billingApi, authApi, factCheckApi } from '@/services/api.service';
import { socketService } from '@/services/socket.service';
import { useToast } from '@/hooks/useToast';
import { betterAuthClient as authClient } from '@/services/betterAuth';
import { useColorScheme } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BACKEND_URL } from '@/constants';

import SettingsSkeleton from '@/components/SettingsSkeleton';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { colorScheme, setColorScheme } = useColorScheme();
  
  const [profile, setProfile] = useState<{ name: string; email: string; tier: string }>({
    name: '',
    email: '',
    tier: 'FREE',
  });
  const [usage, setUsage] = useState<BillingStatus['usage'] | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [loadingRevisions, setLoadingRevisions] = useState<boolean>(true);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  const { showToast, showDialog } = useToast();

  const loadProfile = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const user = await authService.getUser();
      let currentTier = 'FREE';
      let currentUsage = null;
      
      try {
        const billingRes = await billingApi.getStatus();
        if (billingRes.data && billingRes.data.tier) {
          currentTier = billingRes.data.tier;
        }
        if (billingRes.data && billingRes.data.usage) {
          currentUsage = billingRes.data.usage;
        }
      } catch (billingErr) {
        console.log('[SettingsScreen] Failed to fetch active tier status from backend:', billingErr);
      }

      const name = user?.name || user?.email?.split('@')[0] || '';
      setProfile({
        name,
        email: user?.email || '',
        tier: currentTier,
      });
      setEditedName(name);
      setUsage(currentUsage);
      setProfileImage(user?.image || null);

      // Fetch revisions
      setLoadingRevisions(true);
      try {
        const revRes = await factCheckApi.getRevisions();
        if (revRes.data && revRes.data.success) {
          setRevisions(revRes.data.items || []);
        }
      } catch (revErr) {
        console.log('[SettingsScreen] Failed to fetch revisions:', revErr);
      } finally {
        setLoadingRevisions(false);
      }
    } catch (err) {
      console.log('[SettingsScreen] Failed to load session credentials:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;
    let unsubscribeRevisionUpdate: (() => void) | undefined;
    
    async function initSocket() {
      await socketService.connect();
      if (!isCurrent) {
        socketService.disconnect();
        return;
      }
      unsubscribeRevisionUpdate = socketService.onRevisionUpdate((data) => {
        console.log('[SettingsScreen] Socket revision:update event received:', data);
        setRevisions((prev) => 
          prev.map((r) => 
            r.id === data.id 
              ? { ...r, status: data.status, adminComment: data.adminComment ?? r.adminComment }
              : r
          )
        );
      });
    }

    loadProfile();
    initSocket();

    return () => {
      isCurrent = false;
      if (unsubscribeRevisionUpdate) {
        unsubscribeRevisionUpdate();
      }
      socketService.disconnect();
    };
  }, [loadProfile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile(true);
    setRefreshing(false);
  };

  const handleChangePicture = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setIsSaving(true);
        const rawUri = result.assets[0].uri;
        let ext = rawUri.split('.').pop()?.split('?')[0].toLowerCase() || 'jpg';
        if (ext === 'heif') ext = 'heic';

        // Upload to backend
        const res = await api.post('/api/v1/media/upload-avatar', {
          base64Image: result.assets[0].base64,
          extension: ext,
        });

        const publicUrl = res.data.publicUrl;

        // Update user session locally (backend already updated DB)
        const user = await authService.getUser();
        const token = await authService.getToken();
        if (user && token) {
          user.image = publicUrl;
          await authService.saveSession({ user, token, expiresAt: new Date(Date.now() + 86400 * 1000).toISOString() });
        }

        setProfileImage(publicUrl);
        showToast({ title: 'Success', message: 'Profile picture updated!', type: 'success' });
      }
    } catch (err: any) {
      console.log('Upload error', err);
      const serverMsg = err?.response?.data?.message || err?.message || 'Failed to upload image';
      showToast({ title: 'Upload Error', message: serverMsg, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!editedName.trim()) {
      showToast({ title: 'Error', message: 'Name cannot be empty', type: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      const { data, error } = await authClient.updateUser({
        name: editedName.trim(),
      });
      if (error) throw new Error(error.message);
      
      const user = await authService.getUser();
      const token = await authService.getToken();
      if (user && token) {
        user.name = editedName.trim();
        await authService.saveSession({ user, token, expiresAt: new Date(Date.now() + 86400 * 1000).toISOString() });
      }
      
      setProfile(prev => ({ ...prev, name: editedName.trim() }));
      setIsEditing(false);
      showToast({ title: 'Success', message: 'Profile updated successfully', type: 'success' });
    } catch (err) {
      console.log('Update error:', err);
      showToast({ title: 'Error', message: 'Failed to update profile', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    showToast({
      title: "Logging Out...",
      message: "Terminating session and clearing credentials",
      type: "info"
    });

    try {
      try {
        await authApi.signOut();
      } catch (err) {
        console.log('[SettingsScreen] Failed to notify backend of sign out:', err);
      }
      await authService.clearSession();
      
      showToast({
        title: "Session Ended",
        message: "Successfully logged out of your account.",
        type: "success"
      });

      navigation.reset({
        index: 0,
        routes: [{ name: 'Auth' }],
      });
    } catch (err) {
      showToast({
        title: "Logout Error",
        message: "Could not terminate session successfully.",
        type: "error"
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleUpgrade = () => {
    navigation.navigate('Paywall' as any);
  };

  const ProgressBar = ({ used, limit, label }: { used: number, limit: number | null, label: string }) => {
    const isUnlimited = limit === null;
    const percentage = isUnlimited ? 0 : Math.min(100, (used / limit) * 100);
    const isDanger = !isUnlimited && percentage >= 90;
    
    return (
      <View className="mb-5">
        <View className="flex-row justify-between mb-2">
          <Text className="text-text-muted font-body text-xs font-semibold">{label}</Text>
          <Text className="text-text font-mono text-xs font-bold">
            {used} <Text className="text-text-muted">/ {isUnlimited ? '∞' : limit}</Text>
          </Text>
        </View>
        <View className="h-2 w-full bg-surface-low rounded-full overflow-hidden">
          {!isUnlimited && (
            <View 
              className="h-full rounded-full" 
              style={{ 
                width: `${percentage}%`,
                backgroundColor: isDanger ? colors.error.DEFAULT : colors.primary
              }}
            />
          )}
          {isUnlimited && (
            <View className="h-full w-full bg-gold opacity-80 rounded-full" />
          )}
        </View>
      </View>
    );
  };

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  return (
    <ScrollView 
      className="flex-1 bg-background px-6 pt-16"
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
      <View className="mb-8">
        <Text 
          className="font-headline text-3xl font-bold tracking-tight"
          style={{ color: colors.primary }}
        >
          Profile
        </Text>
        <Text className="text-text-muted font-body text-sm mt-1">Manage your account and limits</Text>
      </View>

      {/* User Information Card */}
      <View className="rounded-3xl overflow-hidden mb-6 border-2 border-border shadow-lg">
        <View className="p-6 items-center bg-surface/80">
          <TouchableOpacity 
            className="w-24 h-24 mb-5 relative"
            onPress={handleChangePicture}
            disabled={isSaving}
          >
            <View className="w-24 h-24 rounded-full items-center justify-center border-2 border-primary/30 bg-surface-inner overflow-hidden shadow-lg">
              {profileImage ? (
                <Image source={{ uri: profileImage }} className="w-full h-full" />
              ) : (
                <MaterialIcons name="person" size={42} color={colors.primary} />
              )}
            </View>
            <View 
              className="absolute bottom-0 right-0 w-7 h-7 rounded-full items-center justify-center border-2 border-surface"
              style={{ backgroundColor: colors.primary }}
            >
              <MaterialIcons name="camera-alt" size={13} color="#fff" />
            </View>
          </TouchableOpacity>

          {isEditing ? (
            <View className="w-full">
              <Text className="text-text-muted font-body text-xs ml-4 mb-2">Display Name</Text>
              <TextInput
                value={editedName}
                onChangeText={setEditedName}
                className="w-full h-14 bg-surface-inner rounded-2xl px-5 text-text font-body mb-4 border-2 border-border"
                placeholder="Enter your name"
                placeholderTextColor={colors.text.muted}
                autoFocus
              />
              <View className="flex-row justify-between space-x-3 px-2">
                <Button 
                  onPress={() => {
                    setIsEditing(false);
                    setEditedName(profile.name);
                  }}
                  variant="outline"
                  size="sm"
                  className="flex-1 mr-3"
                  title="Cancel"
                />
                <Button 
                  onPress={handleSaveProfile}
                  disabled={isSaving}
                  loading={isSaving}
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  title="Save"
                />
              </View>
            </View>
          ) : (
            <>
              <View className="flex-row items-center justify-center space-x-2">
                <Text className="text-text font-headline text-xl font-bold">{profile.name}</Text>
                <TouchableOpacity onPress={() => setIsEditing(true)} className="p-2 bg-surface-low rounded-full">
                  <MaterialIcons name="edit" size={16} color={colors.text.muted} />
                </TouchableOpacity>
              </View>
              <Text className="text-text-muted font-body text-sm mt-1 mb-4">{profile.email}</Text>
              
              <View className={`px-4 py-1.5 rounded-full border ${profile.tier === 'PRO' ? 'bg-gold/10 border-gold/30' : profile.tier === 'PREMIUM' ? 'bg-primary/10 border-primary/30' : 'bg-surface-low border-border/10'}`}>
                <Text className={`font-mono text-[10px] font-bold uppercase tracking-widest ${profile.tier === 'PRO' ? 'text-gold' : profile.tier === 'PREMIUM' ? 'text-primary' : 'text-text-muted'}`}>
                  {profile.tier} TIER
                </Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Verification Limits Card */}
      <View className="rounded-3xl overflow-hidden mb-6 border-2 border-border shadow-lg">
        <View className="p-6 bg-surface/60">
          <View className="flex-row items-center mb-6">
            <View className="w-10 h-10 rounded-full bg-secondary/10 items-center justify-center mr-3">
              <MaterialIcons name="analytics" size={20} color={colors.secondary} />
            </View>
            <Text className="text-text font-headline text-lg font-bold">Verification Limits</Text>
          </View>

          {usage ? (
            <>
              <ProgressBar 
                label="Daily Fact Checks" 
                used={usage.daily.used} 
                limit={usage.daily.limit} 
              />
              <ProgressBar 
                label="Monthly Fact Checks" 
                used={usage.monthly.used} 
                limit={usage.monthly.limit} 
              />
              <Text className="text-text-muted font-body text-[10px] text-center mt-2 italic">
                Usage resets at midnight UTC
              </Text>
            </>
          ) : (
            <ActivityIndicator size="small" color={colors.primary} />
          )}
        </View>
      </View>

      {/* Disputes & Revisions History Card */}
      <View className="rounded-3xl overflow-hidden mb-6 border-2 border-border shadow-lg">
        <View className="p-6 bg-surface/60">
          <View className="flex-row items-center mb-6">
            <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-3">
              <MaterialIcons name="gavel" size={20} color={colors.primary} />
            </View>
            <Text className="text-text font-headline text-lg font-bold">Disputes & Revisions</Text>
          </View>

          {loadingRevisions ? (
            <ActivityIndicator size="small" color={colors.primary} className="py-4" />
          ) : revisions.length === 0 ? (
            <View className="items-center py-4 bg-surface-inner rounded-2xl border border-dashed border-border/25 p-4">
              <MaterialIcons name="done-all" size={24} color={colors.text.outline} style={{ marginBottom: 8 }} />
              <Text className="text-text-muted font-body text-xs text-center font-bold">No Active Disputes</Text>
              <Text className="text-text-outline font-body text-[10px] text-center mt-1">
                Flagged AI analysis reports for human review will appear here.
              </Text>
            </View>
          ) : (
            <View className="space-y-4">
              {revisions.map((rev) => {
                const getStatusStyle = (status: string) => {
                  switch (status) {
                    case 'PENDING':
                      return { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-500' };
                    case 'UNDER_REVIEW':
                      return { bg: 'bg-primary/10', border: 'border-primary/20', text: 'text-primary' };
                    case 'RESOLVED':
                      return { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-500' };
                    default:
                      return { bg: 'bg-error/10', border: 'border-error/20', text: 'text-error' };
                  }
                };

                const style = getStatusStyle(rev.status);

                return (
                  <View 
                    key={rev.id} 
                    className="p-4 bg-surface-inner rounded-2xl border border-border/20 space-y-2.5"
                    style={{ marginBottom: 12 }}
                  >
                    <View className="flex-row justify-between items-center">
                      <Text className="text-[10px] font-bold font-mono text-text-outline">
                        REV #{rev.id.substring(4, 10).toUpperCase()}
                      </Text>
                      <View className={`px-2.5 py-0.5 rounded-full border ${style.bg} ${style.border}`}>
                        <Text className={`text-[9px] font-bold uppercase tracking-wider ${style.text}`}>
                          {rev.status}
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row items-center" style={{ gap: 6 }}>
                      <MaterialIcons name="link" size={14} color={colors.primary} />
                      <Text className="text-xs font-semibold text-text flex-1" numberOfLines={1}>
                        {rev.factCheck.videoUrl}
                      </Text>
                    </View>

                    {rev.notes && (
                      <View className="bg-surface/40 p-2.5 rounded-xl border border-border/10">
                        <Text className="text-text-muted font-body text-[11px] italic">
                          &ldquo;{rev.notes}&rdquo;
                        </Text>
                      </View>
                    )}

                    {rev.adminComment && (
                      <View className={`p-2.5 rounded-xl border ${
                        rev.status === 'RESOLVED' ? 'bg-emerald-500/5 border-emerald-500/15' :
                        rev.status === 'DECLINED' ? 'bg-error/5 border-error/15' : 'bg-surface/40 border-border/10'
                      }`}>
                        <Text className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
                          rev.status === 'RESOLVED' ? 'text-emerald-600' :
                          rev.status === 'DECLINED' ? 'text-error' : 'text-text-muted'
                        }`}>
                          Reviewer Feedback:
                        </Text>
                        <Text className={`text-[11px] font-body ${
                          rev.status === 'RESOLVED' ? 'text-emerald-600 dark:text-emerald-400' :
                          rev.status === 'DECLINED' ? 'text-error' : 'text-text'
                        }`}>
                          {rev.adminComment}
                        </Text>
                      </View>
                    )}

                    {rev.status === 'RESOLVED' && (
                      <TouchableOpacity 
                        className="flex-row items-center justify-end pt-1"
                        onPress={() => navigation.navigate('Result', { factCheckId: rev.factCheckId })}
                      >
                        <Text className="text-[10px] font-bold text-primary mr-1">View Revised Report</Text>
                        <MaterialIcons name="arrow-forward" size={12} color={colors.primary} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </View>

      {/* Theme Settings Card */}
      <View className="rounded-3xl overflow-hidden mb-6 border-2 border-border shadow-lg">
        <View className="p-6 bg-surface/60">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-3">
                <MaterialIcons 
                  name={colorScheme === 'dark' ? 'dark-mode' : 'light-mode'} 
                  size={20} 
                  color={colors.primary} 
                />
              </View>
              <View>
                <Text className="text-text font-headline text-[15px] font-bold">Dark Theme</Text>
                <Text className="text-text-muted font-body text-xs mt-0.5">Toggle between light and dark modes</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={async () => {
                try {
                  const nextTheme = colorScheme === 'dark' ? 'light' : 'dark';
                  setColorScheme(nextTheme);
                  await AsyncStorage.setItem('user-theme', nextTheme);
                } catch (e) {
                  console.error('[Theme] Failed to save theme preference:', e);
                }
              }}
              className={`w-14 h-8 rounded-full p-1 justify-center ${colorScheme === 'dark' ? 'bg-primary items-end' : 'bg-surface-low border border-border/15 items-start'}`}
              activeOpacity={0.8}
            >
              <View 
                className="w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center"
              >
                <MaterialIcons 
                  name={colorScheme === 'dark' ? 'bedtime' : 'wb-sunny'} 
                  size={14} 
                  color={colorScheme === 'dark' ? colors.primary : '#d5c68e'} 
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Legal & Policies Card */}
      <View className="rounded-3xl overflow-hidden mb-6 border-2 border-border shadow-lg">
        <View className="p-6 bg-surface/60">
          <Text className="text-text font-headline text-base font-bold mb-4">Legal & Policies</Text>

          <View className="space-y-3">
            {/* Privacy Policy */}
            <TouchableOpacity
              className="flex-row items-center justify-between p-3.5 bg-surface-inner rounded-2xl border border-border/20 mb-3"
              activeOpacity={0.7}
              onPress={() => navigation.navigate('PrivacyPolicy')}
            >
              <View className="flex-row items-center" style={{ gap: 12 }}>
                <View className="w-9 h-9 rounded-full bg-primary/10 items-center justify-center">
                  <MaterialIcons name="security" size={18} color={colors.primary} />
                </View>
                <View>
                  <Text className="text-text font-headline text-sm font-bold">Privacy Policy</Text>
                  <Text className="text-text-muted font-body text-[10px]">Data protection & privacy rights</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.text.muted} />
            </TouchableOpacity>

            {/* Terms of Service */}
            <TouchableOpacity
              className="flex-row items-center justify-between p-3.5 bg-surface-inner rounded-2xl border border-border/20 mb-3"
              activeOpacity={0.7}
              onPress={() => navigation.navigate('TermsOfService')}
            >
              <View className="flex-row items-center" style={{ gap: 12 }}>
                <View className="w-9 h-9 rounded-full bg-secondary/10 items-center justify-center">
                  <MaterialIcons name="gavel" size={18} color={colors.secondary} />
                </View>
                <View>
                  <Text className="text-text font-headline text-sm font-bold">Terms of Service</Text>
                  <Text className="text-text-muted font-body text-[10px]">Terms, rules & user agreement</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.text.muted} />
            </TouchableOpacity>

            {/* Refund Policy */}
            <TouchableOpacity
              className="flex-row items-center justify-between p-3.5 bg-surface-inner rounded-2xl border border-border/20"
              activeOpacity={0.7}
              onPress={() => navigation.navigate('RefundPolicy')}
            >
              <View className="flex-row items-center" style={{ gap: 12 }}>
                <View className="w-9 h-9 rounded-full bg-tertiary/10 items-center justify-center">
                  <MaterialIcons name="receipt-long" size={18} color={colors.tertiary} />
                </View>
                <View>
                  <Text className="text-text font-headline text-sm font-bold">Refund Policy</Text>
                  <Text className="text-text-muted font-body text-[10px]">7-day guarantee & cancellation</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.text.muted} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View>
        <TouchableOpacity
          className={`rounded-[24px] p-5 border-2 flex-row justify-between items-center ${profile.tier === 'PRO' ? 'border-primary bg-primary/5' : 'border-gold bg-gold/5'}`}
          activeOpacity={0.8}
          onPress={handleUpgrade}
          style={{ marginBottom: 16 }}
        >
          <View className="flex-row items-center">
            <MaterialIcons 
              name={profile.tier === 'PRO' ? 'manage-accounts' : 'workspace-premium'} 
              size={24} 
              color={profile.tier === 'PRO' ? colors.primary : colors.gold} 
              style={{ marginRight: 16 }} 
            />
            <View>
              <Text className="text-text font-headline text-[15px] font-bold">
                {profile.tier === 'PRO' ? 'Manage Plan' : 'Upgrade Plan'}
              </Text>
              <Text className="text-text-muted font-body text-xs mt-1">
                {profile.tier === 'PRO' ? 'View your subscription details' : 'Unlock higher AI limits'}
              </Text>
            </View>
          </View>
          <MaterialIcons 
            name="chevron-right" 
            size={20} 
            color={profile.tier === 'PRO' ? colors.primary : colors.gold} 
          />
        </TouchableOpacity>

        <TouchableOpacity
          className="rounded-[24px] p-5 border-2 border-border flex-row justify-between items-center bg-surface"
          activeOpacity={0.8}
          onPress={() => {
            Linking.openURL('https://somiq.veriqlabs.com/support').catch((err) => {
              console.error('[Settings] Failed to open support page:', err);
            });
          }}
        >
          <View className="flex-row items-center">
            <MaterialIcons name="support-agent" size={24} color={colors.primary} style={{ marginRight: 16 }} />
            <View>
              <Text className="text-text font-headline text-[15px] font-bold">Help & Support</Text>
              <Text className="text-text-muted font-body text-xs mt-1">support@veriqlabs.com</Text>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={colors.text.muted} />
        </TouchableOpacity>
      </View>

      {/* Log out CTA button at the bottom */}
      <Button
        onPress={handleLogout}
        loading={isLoggingOut}
        disabled={isLoggingOut}
        variant="secondary"
        title={isLoggingOut ? "Logging Out..." : "Log Out"}
        className="w-full mt-10"
      />
    </ScrollView>
  );
}
