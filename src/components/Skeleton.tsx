import React, { useEffect, useRef } from 'react';
import { View, Animated, ViewStyle, DimensionValue } from 'react-native';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  className?: string;
  style?: ViewStyle;
}

export function Skeleton({ width, height, borderRadius = 8, className = '', style }: SkeletonProps) {
  const pulseAnim = useRef(new Animated.Value(0.12)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.25,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.12,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  // Merge animations with styles
  const animatedStyle = {
    opacity: pulseAnim,
    backgroundColor: '#a1a1aa', // Neutral zinc gray for a clean, theme-agnostic pulsing shimmer
    borderRadius,
    width: width || '100%',
    height: height || '100%',
  } as any;

  return (
    <View 
      className={`bg-border/20 overflow-hidden ${className}`} 
      style={[{ width, height, borderRadius } as any, style]}
    >
      <Animated.View style={animatedStyle} />
    </View>
  );
}

export function HistoryCardSkeleton() {
  return (
    <View className="rounded-3xl p-6 border-2 border-border bg-surface/90 mb-5 flex-col overflow-hidden relative">
      {/* Top Row: Icon + Date + Badge */}
      <View className="flex-row justify-between items-center mb-4 pl-1">
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Skeleton width={36} height={36} borderRadius={12} />
          <Skeleton width={70} height={12} borderRadius={4} />
        </View>
        <Skeleton width={90} height={22} borderRadius={12} />
      </View>

      {/* Title block */}
      <View className="pl-1 mb-2">
        <Skeleton width="85%" height={16} borderRadius={4} className="mb-2" />
        <Skeleton width="60%" height={16} borderRadius={4} />
      </View>

      {/* Audit ID */}
      <View className="pl-1 mb-4">
        <Skeleton width={120} height={8} borderRadius={2} />
      </View>

      {/* Divider */}
      <View className="h-[1px] bg-border/5 mb-4" />

      {/* Bottom source & action buttons row */}
      <View className="flex-row justify-between items-center pl-1">
        <Skeleton width={95} height={28} borderRadius={8} />
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Skeleton width={36} height={36} borderRadius={18} />
          <Skeleton width={75} height={36} borderRadius={18} />
        </View>
      </View>
    </View>
  );
}

export function HomeCardSkeleton() {
  return (
    <View className="flex-row items-center justify-between p-4 rounded-3xl border-2 border-border bg-surface mb-3">
      <View className="flex-row items-center flex-1 pr-3">
        <Skeleton width={48} height={48} borderRadius={16} className="mr-4" />
        <View className="flex-1">
          <Skeleton width="75%" height={14} borderRadius={4} className="mb-2" />
          <Skeleton width="45%" height={10} borderRadius={4} />
        </View>
      </View>
      <Skeleton width={75} height={20} borderRadius={12} />
    </View>
  );
}

export function ResultScreenSkeleton() {
  return (
    <View className="flex-1 bg-background pt-16 px-6 pb-8">
      {/* Top Header Shell */}
      <View className="flex-row items-center justify-between mb-8">
        <View className="flex-row items-center flex-1 pr-4">
          {/* Back button shape */}
          <Skeleton width={44} height={44} borderRadius={22} className="mr-4" />
          <View className="flex-1">
            {/* Analysis ID */}
            <Skeleton width={120} height={10} borderRadius={2} className="mb-2" />
            {/* Video Title */}
            <Skeleton width="85%" height={16} borderRadius={4} />
          </View>
        </View>
        {/* Verdict Badge in Header */}
        <Skeleton width={110} height={28} borderRadius={14} />
      </View>

      {/* Segmented Tab Bar */}
      <View className="flex-row bg-surface-inner rounded-full p-1 mb-6 border border-border/5">
        <View className="flex-1 items-center py-2.5">
          <Skeleton width={60} height={12} borderRadius={4} />
        </View>
        <View className="flex-1 items-center py-2.5">
          <Skeleton width={60} height={12} borderRadius={4} />
        </View>
        <View className="flex-1 items-center py-2.5">
          <Skeleton width={60} height={12} borderRadius={4} />
        </View>
        <View className="flex-1 items-center py-2.5">
          <Skeleton width={60} height={12} borderRadius={4} />
        </View>
      </View>

      {/* Tab Content Area Mock */}
      <View className="flex-1">
        {/* Overall Verdict Gauge Card */}
        <View className="rounded-3xl p-5 border border-border bg-surface-low items-center mb-6">
          {/* Circular Gauge */}
          <Skeleton width={144} height={144} borderRadius={72} className="mb-4" />
          {/* Verdict Sub text */}
          <Skeleton width={180} height={16} borderRadius={4} className="mb-3" />
        </View>

        {/* Detailed text explanation block */}
        <View className="rounded-3xl p-5 border border-border bg-surface/40">
          <Skeleton width="95%" height={12} borderRadius={3} className="mb-2" />
          <Skeleton width="90%" height={12} borderRadius={3} className="mb-2" />
          <Skeleton width="85%" height={12} borderRadius={3} className="mb-2" />
          <Skeleton width="60%" height={12} borderRadius={3} />
        </View>
      </View>

      {/* FAB Actions (Fixed at Bottom) */}
      <View className="mt-4 flex-row justify-between items-center" style={{ gap: 12 }}>
        <Skeleton width="48%" height={38} borderRadius={19} />
        <Skeleton width="48%" height={38} borderRadius={19} />
      </View>
    </View>
  );
}
