import { useState, useEffect } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { authApi } from '../services/api.service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushNotifications(isLoggedIn: boolean) {
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    if (!isLoggedIn) return;

    checkPermissionStatus();
    
    // Set up notification tap listener
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const factCheckId = response.notification.request.content.data?.factCheckId;
      if (typeof factCheckId === 'string') {
        // Automatically navigate to the result screen
        navigation.navigate('Result', { factCheckId });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isLoggedIn]);

  const checkPermissionStatus = async () => {
    if (!Device.isDevice) return;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    
    if (existingStatus === 'granted') {
      // Already granted, silently get token and register
      registerForPushNotificationsAsync();
    } else if (existingStatus === 'undetermined') {
      // We haven't asked yet. Check if we've shown the custom modal before
      const hasSeenModal = await AsyncStorage.getItem('hasSeenPushModal');
      if (!hasSeenModal) {
        setShowPermissionModal(true);
      }
    }
  };

  const handleAllowPush = async () => {
    setShowPermissionModal(false);
    await AsyncStorage.setItem('hasSeenPushModal', 'true');
    await registerForPushNotificationsAsync();
  };

  const handleDeclinePush = async () => {
    setShowPermissionModal(false);
    await AsyncStorage.setItem('hasSeenPushModal', 'true');
  };

  async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#059669',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        return;
      }
      try {
        const projectId =
          Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
        
        token = (
          await Notifications.getExpoPushTokenAsync({
            projectId,
          })
        ).data;
        
        // Send token to backend
        if (token) {
          await authApi.registerPushToken(token);
        }
      } catch (e) {
        console.log('Failed to get push token:', e);
      }
    }

    return token;
  }

  return {
    showPermissionModal,
    handleAllowPush,
    handleDeclinePush,
  };
}
