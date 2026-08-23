import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, ActivityIndicator, Image, Animated, TouchableOpacity, Dimensions, BackHandler } from 'react-native';
import { useColorScheme } from 'nativewind';
import * as SecureStore from 'expo-secure-store';
import type { RootStackParamList, MainTabParamList } from '@/types';
import { colors } from '@/theme/colors';
import { authService } from '@/services/auth.service';
import Constants from 'expo-constants';
import { BACKEND_URL } from '@/constants';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useToast } from '@/hooks/useToast';
import * as Updates from 'expo-updates';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as ExpoSplashScreen from 'expo-splash-screen';

// Screens
import AuthScreen from '@/screens/AuthScreen';
import HomeScreen from '@/screens/HomeScreen';
import HistoryScreen from '@/screens/HistoryScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import ProcessingScreen from '@/screens/ProcessingScreen';
import ResultScreen from '@/screens/ResultScreen';
import PaywallScreen from '@/screens/PaywallScreen';
import VerificationScreen from '@/screens/VerificationScreen';
import OnboardingScreen from '@/screens/OnboardingScreen';
import PrivacyPolicyScreen from '@/screens/PrivacyPolicyScreen';
import TermsOfServiceScreen from '@/screens/TermsOfServiceScreen';
import RefundPolicyScreen from '@/screens/RefundPolicyScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// BrandTheme is defined dynamically inside AppNavigator below.

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { showDialog } = useToast();
  
  // The bolt button was removed.

  const renderTab = (route: any, index: number) => {
    const { options } = descriptors[route.key];
    const label =
      options.tabBarLabel !== undefined
        ? options.tabBarLabel
        : options.title !== undefined
        ? options.title
        : route.name;

    const isFocused = state.index === index;

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };

    let iconName: keyof typeof MaterialIcons.glyphMap = 'home';
    if (route.name === 'Home') iconName = 'home';
    else if (route.name === 'Verification') iconName = 'verified-user';
    else if (route.name === 'History') iconName = 'history';
    else if (route.name === 'Profile') iconName = 'person';

    return (
      <TouchableOpacity
        key={route.key}
        onPress={onPress}
        activeOpacity={0.8}
        className={`flex-1 flex-col items-center justify-center py-2.5 rounded-2xl ${
          isFocused ? 'bg-emerald/30 border border-primary/20' : 'bg-transparent border border-transparent'
        }`}
      >
        <MaterialIcons 
          name={iconName} 
          size={22} 
          color={isFocused ? colors.primary : colors.text.outline} 
        />
        <Text 
          className="text-[9px] font-bold mt-1 tracking-wider uppercase"
          style={{ color: isFocused ? colors.primary : colors.text.outline }}
        >
          {label as string}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View 
      className="absolute bottom-0 left-0 right-0 flex-row justify-around items-center bg-surface/95 border-t border-border/10 rounded-t-[32px] pt-3 px-4 shadow-2xl"
      style={{ paddingBottom: Math.max(insets.bottom, 12), height: 75 + Math.max(insets.bottom, 12) * 0.5 }}
    >
      {renderTab(state.routes[0], 0)}
      {renderTab(state.routes[1], 1)}
      


      {renderTab(state.routes[2], 2)}
      {renderTab(state.routes[3], 3)}
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Verification" component={VerificationScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Profile" component={SettingsScreen} />
    </Tab.Navigator>
  );
}


import { useShareIntentContext } from 'expo-share-intent';
import { useNavigationContainerRef } from '@react-navigation/native';



export default function AppNavigator() {
  const { colorScheme } = useColorScheme();
  const brandTheme = React.useMemo(() => ({
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface.darkest,
      text: colors.text.DEFAULT,
      border: colors.surface.bright,
    },
  }), [colorScheme]);

  const [initialRoute, setInitialRoute] = React.useState<'Onboarding' | 'Auth' | 'Main' | null>(null);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const { showToast, showDialog } = useToast();
  const hasPromptedForUpdate = React.useRef(false);

  React.useEffect(() => {
    async function checkForUpdates() {
      if (__DEV__ || !Updates.isEnabled || hasPromptedForUpdate.current) {
        return;
      }
      try {
        // 1. Fetch Remote Config App Settings
        const configResponse = await fetch(`${BACKEND_URL}/api/v1/app-config`);
        if (!configResponse.ok) {
          throw new Error('Failed to fetch remote app configuration');
        }
        const remoteConfig = await configResponse.json();
        
        const localVersion = Constants.expoConfig?.version || '1.0.0';
        const minVersion = remoteConfig.minRequiredVersion || '1.0.0';
        const otaPolicy = remoteConfig.otaUpdatePolicy || 'silent';
        
        console.log('[Updates] Remote Config:', remoteConfig, 'Local Version:', localVersion);

        // Helper to check if local version is older than minimum version
        const isVersionOlder = (local: string, target: string) => {
          const lParts = local.split('.').map(Number);
          const tParts = target.split('.').map(Number);
          for (let i = 0; i < Math.max(lParts.length, tParts.length); i++) {
            const l = lParts[i] || 0;
            const t = tParts[i] || 0;
            if (l < t) return true;
            if (l > t) return false;
          }
          return false;
        };

        const isMandatory = otaPolicy === 'mandatory' || isVersionOlder(localVersion, minVersion);

        // 2. Check if an OTA update is available on Expo
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable && !hasPromptedForUpdate.current) {
          // Silent Updates: download silently in the background
          if (otaPolicy === 'silent' && !isMandatory) {
            console.log('[Updates] Silent update detected, downloading in background...');
            await Updates.fetchUpdateAsync();
            console.log('[Updates] Silent update download complete. Will apply on next restart.');
            return;
          }

          hasPromptedForUpdate.current = true;

          if (isMandatory) {
            // Mandatory Updates: user cannot cancel, must update immediately
            showDialog({
              title: "Critical Update Required",
              message: "A critical update is required to continue using Somiq. Please update now.",
              buttons: [
                {
                  text: "Update Now",
                  onPress: async () => {
                    await triggerUpdate();
                  },
                }
              ]
            });
          } else {
            // Optional Updates: show dialog with a cancel (Later) option
            showDialog({
              title: "Update Available",
              message: "A new version of Somiq is available. Would you like to update now?",
              buttons: [
                {
                  text: "Later",
                  style: "cancel",
                },
                {
                  text: "Update Now",
                  onPress: async () => {
                    await triggerUpdate();
                  },
                },
              ],
            });
          }
        }
      } catch (err) {
        console.warn("[Updates] Check failed:", err);
      }
    }

    async function triggerUpdate() {
      try {
        showToast({
          title: "Updating",
          message: "Downloading updates...",
          type: "info",
          duration: 4000,
        });
        const fetchResult = await Updates.fetchUpdateAsync();
        if (fetchResult.isNew) {
          showToast({
            title: "Success",
            message: "Update applied. Restarting...",
            type: "success",
            duration: 2000,
          });
          setTimeout(async () => {
            await Updates.reloadAsync();
          }, 1000);
        } else {
          showToast({
            title: "Up to Date",
            message: "App is already using the latest version.",
            type: "info",
          });
        }
      } catch (err) {
        console.error("[Updates] Fetch error:", err);
        showToast({
          title: "Update Failed",
          message: "Failed to download update. We will try again next time.",
          type: "error",
        });
      }
    }

    checkForUpdates();
  }, [showToast, showDialog]);

  React.useEffect(() => {
    console.log('[ShareIntent] Native State Updated:', { hasShareIntent, shareIntent });
  }, [hasShareIntent, shareIntent]);

  React.useEffect(() => {
    async function checkAuth() {
      let targetRoute: 'Onboarding' | 'Auth' | 'Main' = 'Auth';
      let logged = false;
      try {
        const hasSeenOnboarding = await SecureStore.getItemAsync('has_seen_onboarding');
        logged = await authService.isLoggedIn();
        setIsLoggedIn(logged);
        
        if (hasSeenOnboarding !== 'true') {
          targetRoute = 'Onboarding';
        } else {
          targetRoute = logged ? 'Main' : 'Auth';
        }
      } catch {
        targetRoute = 'Auth';
      } finally {
        setInitialRoute(targetRoute);
      }
    }
    checkAuth();
  }, []);

  React.useEffect(() => {
    if (initialRoute !== null) {
      ExpoSplashScreen.hideAsync().catch((err: any) => {
        console.warn('[SplashScreen] hideAsync failed:', err);
      });
    }
  }, [initialRoute]);

  React.useEffect(() => {
    // Only process the share intent if the user is logged in and the main navigator is active
    if (hasShareIntent && (shareIntent?.text || shareIntent?.webUrl) && isLoggedIn && initialRoute === 'Main') {
      const text = shareIntent.text || shareIntent.webUrl || '';
      console.log('[ShareIntent] Processing text value:', text);
      const urlMatch = text.match(/https?:\/\/[^\s]+/);
      
      if (urlMatch) {
        const url = urlMatch[0];
        console.log('[ShareIntent] Found URL match:', url);
        const routeIntent = () => {
          if (navigationRef.isReady()) {
            // Add a 500ms delay to let React Navigation settle its initial screen layout
            console.log('[ShareIntent] Navigation ready, scheduling routing in 500ms for stability...');
            setTimeout(() => {
              console.log('[ShareIntent] Navigating to Processing with URL:', url);
              navigationRef.navigate('Processing', { url: url });
              resetShareIntent();
            }, 500);
          } else {
            console.log('[ShareIntent] Navigation NOT ready, retrying routing in 100ms...');
            setTimeout(routeIntent, 100);
          }
        };
        routeIntent();
      } else {
        console.log('[ShareIntent] No URL match found in shared text. Resetting share intent.');
        resetShareIntent();
      }
    }
  }, [hasShareIntent, shareIntent, isLoggedIn, initialRoute, navigationRef]);

  if (initialRoute === null) {
    return null;
  }

  return (
    <NavigationContainer theme={brandTheme} ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen
          name="Auth"
          children={() => (
            <AuthScreen onLoginSuccess={() => setIsLoggedIn(true)} />
          )}
        />
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="Processing" component={ProcessingScreen} />
        <Stack.Screen name="Result" component={ResultScreen} />
        <Stack.Screen name="Paywall" component={PaywallScreen} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
        <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
        <Stack.Screen name="RefundPolicy" component={RefundPolicyScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
