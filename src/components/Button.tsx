import React from 'react';
import {
  Text,
  ActivityIndicator,
  View,
} from 'react-native';
import { colors } from '@/theme/colors';
import { useColorScheme } from 'nativewind';
import { TactileTouchable } from './TactileTouchable';

interface ButtonProps {
  onPress?: () => void;
  title?: string;
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Button({
  onPress,
  title,
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  icon,
  rightIcon,
}: ButtonProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Base touchable styles
  const baseButtonClass = "flex-row items-center justify-center font-bold border-2 rounded-2xl relative overflow-hidden";
  
  // Height & padding styles
  const sizeClasses = {
    sm: "h-11 px-4 gap-1.5",
    md: "h-14 px-6 gap-2",
    lg: "h-16 px-8 gap-2.5",
  };

  // Color theme classes (for light & dark)
  const variantClasses = {
    primary: isDark 
      ? "bg-primary border-transparent" 
      : "bg-accentLavender border-[#1A1A1A]",
    secondary: isDark 
      ? "bg-surface-low border-border" 
      : "bg-white border-[#1A1A1A]",
    outline: isDark 
      ? "bg-transparent border-border" 
      : "bg-transparent border-[#1A1A1A]",
    ghost: "bg-transparent border-transparent",
  };

  const textClasses = {
    primary: isDark ? "text-background font-bold" : "text-[#1A1A1A] font-bold",
    secondary: isDark ? "text-text font-bold" : "text-[#1A1A1A] font-bold",
    outline: isDark ? "text-text font-bold" : "text-[#1A1A1A] font-bold",
    ghost: isDark ? "text-text font-bold" : "text-[#1A1A1A] font-bold",
  };

  const textSizes = {
    sm: "text-[13px]",
    md: "text-[15px]",
    lg: "text-[17px]",
  };

  const isDisabled = disabled || loading;

  return (
    <TactileTouchable
      onPress={onPress}
      disabled={isDisabled}
      scaleTo={0.95}
      activeOpacity={0.9}
      className={`${baseButtonClass} ${sizeClasses[size]} ${variantClasses[variant]} ${isDisabled ? 'opacity-50' : ''} ${className}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' && isDark ? colors.background : colors.text.DEFAULT} />
      ) : (
        <>
          {icon && <View style={{ marginRight: 6 }}>{icon}</View>}
          <Text className={`${textClasses[variant]} ${textSizes[size]} font-headline`}>
            {title || children}
          </Text>
          {rightIcon && <View style={{ marginLeft: 6 }}>{rightIcon}</View>}
        </>
      )}
    </TactileTouchable>
  );
}
