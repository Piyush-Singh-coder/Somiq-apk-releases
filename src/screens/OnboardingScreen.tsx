import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  StatusBar,
  Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/types";
import { colors } from "@/theme/colors";
import { Button } from "@/components/Button";
import { useColorScheme } from "nativewind";
import { MaterialIcons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { authService } from "@/services/auth.service";

const { width, height } = Dimensions.get("window");

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface OnboardingSlide {
  title: string;
  tagline: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  iconBg: string;
  iconColor: string;
}

export default function OnboardingScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [activePage, setActivePage] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const slides: OnboardingSlide[] = [
    {
      title: "Verify the Truth",
      tagline: "AI CLAIM VERIFICATION",
      description: "Audit viral claims from social media. Paste a link or upload a video and our AI pipeline transcribes, extracts claims, and cross-references them against trusted sources.",
      icon: "verified-user",
      iconBg: "bg-primary/10",
      iconColor: colors.primary,
    },
    {
      title: "Way 1: Quick Share",
      tagline: "DIRECT OS INTEGRATION",
      description: "Tap 'Share' while watching reels or shorts on Instagram or YouTube and select Somiq to trigger verification instantly.",
      icon: "share",
      iconBg: "bg-secondary/10",
      iconColor: colors.secondary,
    },
    {
      title: "Way 2: Copy & Paste",
      tagline: "LINK DEEP AUDITING",
      description: "Copy any video link and open the Somiq app. We'll automatically detect it on your clipboard, or you can paste it manually.",
      icon: "content-paste",
      iconBg: "bg-primary/10",
      iconColor: colors.primary,
    },
    {
      title: "Privacy-First Design",
      tagline: "SECURE BY DESIGN",
      description: "Your video links are processed on encrypted servers. We never store raw video files. Only the transcription and result are retained for your history.",
      icon: "phonelink-lock",
      iconBg: "bg-amber-500/10",
      iconColor: "#d5c68e",
    },
  ];

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(offsetX / width);
    if (pageIndex !== activePage) {
      setActivePage(pageIndex);
    }
  };

  const handleNext = () => {
    if (activePage < slides.length - 1) {
      scrollViewRef.current?.scrollTo({
        x: (activePage + 1) * width,
        animated: true,
      });
      setActivePage(activePage + 1);
    } else {
      handleFinishOnboarding();
    }
  };

  const handleSkip = () => {
    handleFinishOnboarding();
  };

  const handleFinishOnboarding = async () => {
    try {
      await SecureStore.setItemAsync("has_seen_onboarding", "true");
      const logged = await authService.isLoggedIn();
      navigation.replace(logged ? "Main" : "Auth");
    } catch (err) {
      // Fallback
      navigation.replace("Auth");
    }
  };

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Top Header: Brand Name + Skip */}
      <View className="flex-row justify-between items-center px-6 pt-14 pb-4 bg-background">
        <View className="flex-row items-center gap-1.5">
          <MaterialIcons name="shield" size={20} color={colors.primary} />
          <Text className="text-text font-bold text-lg tracking-tight">
            Somiq <Text className="text-primary font-bold">AI</Text>
          </Text>
        </View>

        {activePage < slides.length - 1 && (
          <TouchableOpacity
            onPress={handleSkip}
            className="px-4 py-1.5 rounded-xl bg-surface border-2 border-border"
            activeOpacity={0.7}
          >
            <Text className="text-text-muted text-xs font-bold uppercase tracking-wider">
              Skip
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Slide Carousel */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        className="flex-1"
      >
        {slides.map((slide, index) => (
          <View
            key={index}
            style={{ width }}
            className="flex-1 justify-center items-center px-8"
          >
            {/* Visual Icon Container */}
            <View className="relative mb-12">
              {/* Outer ambient glow curved-edges square backgrounds */}
              <View className="absolute -inset-8 rounded-3xl bg-primary/5 blur-xl" />
              <View className="absolute -inset-14 rounded-[48px] bg-primary/2 blur-2xl" />

              <View
                className={`w-48 h-48 rounded-3xl ${slide.iconBg} border-2 border-border justify-center items-center shadow-lg px-4`}
              >
                {index === 0 ? (
                  <Image
                    source={{ uri: "https://ik.imagekit.io/v6xwevpjp/Veriq/Somiq/somiq-no-bg-logo.png?tr=w-512,q-80,f-png" }}
                    style={{ width: 110, height: 110 }}
                    resizeMode="contain"
                  />
                ) : (
                  <MaterialIcons name={slide.icon as any} size={88} color={slide.iconColor} />
                )}
              </View>
            </View>

            {/* Slide Text Content */}
            <View className="items-center text-center space-y-3">
              <Text className="text-[10px] font-mono font-bold tracking-widest text-primary uppercase">
                {slide.tagline}
              </Text>
              <Text className="text-text font-bold text-3xl text-center tracking-tight leading-tight mt-1">
                {slide.title}
              </Text>
              <Text className="text-text-muted text-sm text-center leading-relaxed max-w-sm mt-3 px-2">
                {slide.description}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Footer Navigation Area */}
      <View className="px-6 py-10 flex-col items-center justify-between border-t border-border/5 bg-background">
        
        {/* Dot Indicators */}
        <View className="flex-row gap-2 mb-8">
          {slides.map((_, index) => (
            <View
              key={index}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                activePage === index ? "w-8 bg-primary" : "w-2.5 bg-border/20"
              }`}
            />
          ))}
        </View>

        {/* Action Buttons */}
        <Button
          onPress={handleNext}
          variant="primary"
          size="md"
          className="w-full"
          rightIcon={
            <MaterialIcons
              name={activePage === slides.length - 1 ? "check-circle" : "arrow-forward"}
              size={18}
              color={colorScheme === 'dark' ? colors.background : '#1A1A1A'}
            />
          }
          title={activePage === slides.length - 1 ? "GET STARTED" : "CONTINUE"}
        />
      </View>
    </View>
  );
}
