import React, { useEffect, useRef } from 'react';
import { View, Animated, ScrollView } from 'react-native';
import { colors } from '@/theme/colors';

export default function SettingsSkeleton() {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.8,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <ScrollView
      className="flex-1 bg-background px-6 pt-16"
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Title Header Skeleton */}
      <View className="mb-8">
        <Animated.View
          style={{ opacity: pulseAnim }}
          className="h-8 w-36 bg-surface-inner rounded-xl mb-2"
        />
        <Animated.View
          style={{ opacity: pulseAnim }}
          className="h-4 w-56 bg-surface-inner rounded-lg"
        />
      </View>

      {/* User Information Card Skeleton */}
      <View className="rounded-3xl p-6 mb-6 border-2 border-border/40 bg-surface/80 items-center">
        <Animated.View
          style={{ opacity: pulseAnim }}
          className="w-24 h-24 rounded-full bg-surface-inner mb-4"
        />
        <Animated.View
          style={{ opacity: pulseAnim }}
          className="h-6 w-40 bg-surface-inner rounded-xl mb-2"
        />
        <Animated.View
          style={{ opacity: pulseAnim }}
          className="h-4 w-52 bg-surface-inner rounded-lg mb-4"
        />
        <Animated.View
          style={{ opacity: pulseAnim }}
          className="h-6 w-28 bg-surface-inner rounded-full"
        />
      </View>

      {/* AI Usage Limits Card Skeleton */}
      <View className="rounded-3xl p-6 mb-6 border-2 border-border/40 bg-surface/60 space-y-4">
        <View className="flex-row items-center mb-2">
          <Animated.View
            style={{ opacity: pulseAnim }}
            className="w-10 h-10 rounded-full bg-surface-inner mr-3"
          />
          <Animated.View
            style={{ opacity: pulseAnim }}
            className="h-5 w-36 bg-surface-inner rounded-lg"
          />
        </View>

        <View className="mb-4">
          <View className="flex-row justify-between mb-2">
            <Animated.View style={{ opacity: pulseAnim }} className="h-3 w-28 bg-surface-inner rounded" />
            <Animated.View style={{ opacity: pulseAnim }} className="h-3 w-16 bg-surface-inner rounded" />
          </View>
          <Animated.View style={{ opacity: pulseAnim }} className="h-2 w-full bg-surface-inner rounded-full" />
        </View>

        <View>
          <View className="flex-row justify-between mb-2">
            <Animated.View style={{ opacity: pulseAnim }} className="h-3 w-32 bg-surface-inner rounded" />
            <Animated.View style={{ opacity: pulseAnim }} className="h-3 w-16 bg-surface-inner rounded" />
          </View>
          <Animated.View style={{ opacity: pulseAnim }} className="h-2 w-full bg-surface-inner rounded-full" />
        </View>
      </View>

      {/* Disputes & Revisions Skeleton */}
      <View className="rounded-3xl p-6 mb-6 border-2 border-border/40 bg-surface/60">
        <View className="flex-row items-center mb-4">
          <Animated.View style={{ opacity: pulseAnim }} className="w-10 h-10 rounded-full bg-surface-inner mr-3" />
          <Animated.View style={{ opacity: pulseAnim }} className="h-5 w-44 bg-surface-inner rounded-lg" />
        </View>
        <Animated.View style={{ opacity: pulseAnim }} className="h-20 w-full bg-surface-inner rounded-2xl" />
      </View>

      {/* Legal & Actions List Skeleton */}
      <View className="space-y-4">
        {[1, 2, 3, 4].map((item) => (
          <Animated.View
            key={item}
            style={{ opacity: pulseAnim }}
            className="h-16 w-full bg-surface-inner rounded-[24px] mb-3 border border-border/20"
          />
        ))}
      </View>
    </ScrollView>
  );
}
