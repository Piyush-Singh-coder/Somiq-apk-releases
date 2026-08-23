import './global.css';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from '@/navigation/AppNavigator';
import { ToastProvider } from '@/context/ToastContext';
import { ShareIntentProvider } from 'expo-share-intent';
import { useColorScheme, vars } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';

// Prevent automatic hiding of native splash screen
SplashScreen.preventAutoHideAsync().catch((err) => {
  console.warn('[SplashScreen] preventAutoHideAsync failed:', err);
});


const themeVars = {
  light: vars({
    '--background': '252 250 247',
    '--surface': '255 255 255',
    '--surface-low': '243 238 228',
    '--surface-high': '255 255 255',
    '--surface-inner': '251 249 244',
    '--primary': '56 189 248',
    '--secondary': '14 165 233',
    '--tertiary': '2 132 199',
    '--text-primary': '26 21 35',
    '--text-secondary': '90 84 103',
    '--text-muted': '142 136 157',
    '--text-disabled': '188 183 199',
    '--border': '26 21 35',
    '--success': '16 185 129',
    '--danger': '244 63 94',
    '--gold': '180 83 9',
    '--gold-soft': '217 119 6',
  }),
  dark: vars({
    '--background': '11 15 26',
    '--surface': '17 24 39',
    '--surface-low': '15 23 42',
    '--surface-high': '26 34 56',
    '--surface-inner': '18 24 38',
    '--primary': '56 189 248',
    '--secondary': '14 165 233',
    '--tertiary': '2 132 199',
    '--text-primary': '255 255 255',
    '--text-secondary': '209 213 219',
    '--text-muted': '156 163 175',
    '--text-disabled': '107 114 128',
    '--border': '31 41 55',
    '--success': '16 185 129',
    '--danger': '244 63 94',
    '--gold': '213 198 142',
    '--gold-soft': '242 226 167',
  }),
};

export default function App() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    async function loadTheme() {
      try {
        const savedTheme = await AsyncStorage.getItem('user-theme');
        if (savedTheme === 'light' || savedTheme === 'dark') {
          setColorScheme(savedTheme);
        }
      } catch (e) {
        console.error('[Theme] Failed to load persisted theme:', e);
      }
    }
    loadTheme();
  }, [setColorScheme]);

  return (
    <View style={isDark ? themeVars.dark : themeVars.light} className="flex-1">
      <ShareIntentProvider>
        <SafeAreaProvider>
          <ToastProvider>
            <AppNavigator />
          </ToastProvider>
        </SafeAreaProvider>
      </ShareIntentProvider>
    </View>
  );
}

