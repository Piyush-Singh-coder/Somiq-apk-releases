import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform as RNPlatform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/types';
import { colors } from '@/theme/colors';
import { Button } from '@/components/Button';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useToast } from '@/hooks/useToast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { billingApi } from '@/services/api.service';
import { authService } from '@/services/auth.service';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function VerificationScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [url, setUrl] = useState('');
  const [isFreeUser, setIsFreeUser] = useState(true); // Default to Free for safety, then fetch
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  useFocusEffect(
    React.useCallback(() => {
      let isCurrent = true;
      async function checkTier() {
        try {
          // Fast check: read from local session storage first
          const localUser = await authService.getUser();
          if (isCurrent && localUser && localUser.tier) {
            setIsFreeUser(localUser.tier === 'FREE');
          }

          // Fetch fresh status from backend
          const billingRes = await billingApi.getStatus();
          if (isCurrent && billingRes.data && billingRes.data.tier) {
            const freshTier = billingRes.data.tier;
            setIsFreeUser(freshTier === 'FREE');

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
        } catch (err) {
          console.log('[VerificationScreen] Error fetching billing status:', err);
        }
      }
      checkTier();
      return () => {
        isCurrent = false;
      };
    }, [])
  );

  const handleVerifyUrl = () => {
    if (!url) {
      showToast({
        title: 'Link Required',
        message: 'Please paste a YouTube Shorts, Instagram Reels or TikTok link first.',
        type: 'warning',
      });
      return;
    }

    const isTikTok = url.toLowerCase().includes('tiktok.com') || url.toLowerCase().includes('tiktokv.com');
    if (isTikTok && isFreeUser) {
      showToast({
        title: 'Premium Feature',
        message: 'TikTok verification is exclusive to Premium and Pro tiers. Please upgrade your plan.',
        type: 'info',
      });
      navigation.navigate('Paywall');
      return;
    }

    navigation.navigate('Processing', { url });
  };

  const handlePickMedia = async () => {
    if (isFreeUser) {
      showToast({
        title: 'Premium Feature',
        message: 'Local video and image uploads are exclusive to Premium and Pro tiers. Please upgrade your plan.',
        type: 'info',
      });
      navigation.navigate('Paywall');
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0].uri) {
        const asset = result.assets[0];
        const isVideo = asset.type === 'video' || asset.uri.endsWith('.mp4');
        
        if (isVideo && asset.duration && asset.duration > 180000) {
          showToast({
            title: 'Video Too Long',
            message: 'Local video uploads are limited to a maximum of 3 minutes.',
            type: 'warning',
          });
          return;
        }

        const platform = isVideo ? 'LOCAL_VIDEO' : 'LOCAL_IMAGE';
        
        navigation.navigate('Processing', { 
          url: asset.uri, 
          isLocalFile: true, 
          localPlatform: platform 
        });
      }
    } catch (error) {
      console.log('Error picking media:', error);
      showToast({ title: 'Error', message: 'Failed to open gallery.', type: 'error' });
    }
  };

  return (
    <KeyboardAvoidingView 
      className="flex-1 bg-background"
      behavior={RNPlatform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View 
        className="px-6 pb-4 border-b border-border/5 bg-background"
        style={{ paddingTop: Math.max(insets.top, 60) }}
      >
        <Text className="text-text font-headline text-[24px] font-bold">Verification</Text>
        <Text className="text-text-muted text-[13px] mt-1">Submit content for AI deepfake and fact-check analysis.</Text>
      </View>

      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ padding: 24, paddingBottom: 180, gap: 24 }}
        showsVerticalScrollIndicator={false}
      >
        
        {/* Social Media Link Card */}
        <View className="rounded-3xl p-6 border-2 border-border bg-surface shadow-lg relative overflow-hidden">
          <View className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-primary/10" />
          
          <View className="flex-row items-center mb-6">
            <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center mr-4">
              <MaterialIcons name="link" size={24} color={colors.primary} />
            </View>
            <View>
              <Text className="text-text font-headline text-[16px] font-bold">Social Media URL</Text>
              <Text className="text-text-muted text-[11px] mt-0.5">YouTube, Instagram Reels & TikTok</Text>
            </View>
          </View>
          
          <View className="bg-background border-2 border-border rounded-[20px] mb-4 relative flex-row items-center justify-between">
            <TextInput
              className="flex-1 h-14 text-text font-body text-[14px] pl-5 pr-12 text-text"
              placeholder="Paste video link here..."
              placeholderTextColor={colors.text.outline}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {url.length > 0 ? (
              <TouchableOpacity 
                onPress={() => setUrl('')} 
                className="absolute right-4 bg-border/10 rounded-full p-1"
              >
                <MaterialIcons name="close" size={14} color={colors.text.outline} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                onPress={async () => {
                  try {
                    const clipboardContent = await Clipboard.getStringAsync();
                    if (clipboardContent && clipboardContent.trim()) {
                      setUrl(clipboardContent.trim());
                      showToast({
                        title: 'Link Pasted',
                        message: 'Successfully pasted link from clipboard.',
                        type: 'success',
                      });
                    } else {
                      showToast({
                        title: 'Clipboard Empty',
                        message: 'No text content found in your clipboard.',
                        type: 'warning',
                      });
                    }
                  } catch (err) {
                    showToast({
                      title: 'Access Blocked',
                      message: 'Could not read from clipboard.',
                      type: 'error',
                    });
                  }
                }} 
                className="absolute right-4 p-1"
              >
                <MaterialIcons name="content-paste" size={20} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
          
          <Button
            onPress={handleVerifyUrl}
            variant="primary"
            size="md"
            className="w-full"
            icon={<MaterialIcons name="search" size={20} color={colors.text.DEFAULT} />}
            title="Analyze Content"
          />
        </View>

        {/* OR Divider */}
        <View className="flex-row items-center py-2">
          <View className="flex-1 h-[1px] bg-border/10" />
          <Text className="text-text-muted text-[12px] font-bold mx-4 uppercase tracking-widest">OR</Text>
          <View className="flex-1 h-[1px] bg-border/10" />
        </View>

        {/* Local Media Upload Card */}
        <View className="rounded-3xl p-6 border-2 border-border bg-surface shadow-lg relative overflow-hidden">
          <View className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-gold/5" />
          
          <View className="flex-row items-center mb-4">
            <View className="w-12 h-12 rounded-full bg-gold/20 items-center justify-center mr-4">
              <MaterialIcons name="perm-media" size={24} color={colors.gold} />
            </View>
            <View className="flex-1">
              <Text className="text-text font-headline text-[16px] font-bold">Local File</Text>
              <Text className="text-text-muted text-[11px] mt-0.5">Upload a video or image from your gallery</Text>
            </View>
          </View>
          
          <TouchableOpacity
            onPress={handlePickMedia}
            activeOpacity={0.8}
            className="bg-primary/5 border-2 border-border border-dashed rounded-[16px] p-6 mt-2 items-center justify-center flex-row"
          >
            <MaterialIcons 
              name={isFreeUser ? "lock" : "file-upload"} 
              size={24} 
              color={isFreeUser ? colors.gold : colors.text.outline} 
              style={{ marginRight: 8 }} 
            />
            <Text className="text-text font-headline text-[14px] font-bold">
              {isFreeUser ? "Unlock Local Uploads" : "Choose from Gallery"}
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}
