import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/types";
import { colors } from "@/theme/colors";
import { authApi } from "@/services/api.service";
import { authService } from "@/services/auth.service";
import { betterAuthClient } from "@/services/betterAuth";
import * as Linking from "expo-linking";
import { MaterialIcons, AntDesign } from "@expo/vector-icons";
import { useToast } from "@/hooks/useToast";
import { useColorScheme } from "nativewind";
import GoogleIcon from "@/components/GoogleIcon";
import { Button } from "@/components/Button";
import { cleanErrorMessage } from "@/utils/errors";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface AuthScreenProps {
  onLoginSuccess?: () => void;
}

export default function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  const navigation = useNavigation<NavigationProp>();
  const { colorScheme } = useColorScheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  
  // Focus states for input glows
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  
  const { showToast, showDialog } = useToast();

  useEffect(() => {
    async function checkSession() {
      const logged = await authService.isLoggedIn();
      if (logged) {
        navigation.replace("Main");
      }
    }
    checkSession();
  }, []);

  const toggleAuthMode = (register: boolean) => {
    setIsRegister(register);
    setEmail("");
    setPassword("");
    setName("");
    setShowPassword(false);
    setNameFocused(false);
    setEmailFocused(false);
    setPasswordFocused(false);
  };

  const handleAuth = async () => {
    if (isRegister && !name.trim()) {
      showToast({
        title: "Name Required",
        message: "Please enter your full name to register.",
        type: "warning"
      });
      return;
    }
    if (!email || !password) {
      showToast({
        title: "Incomplete Credentials",
        message: "Please fill in all fields to proceed.",
        type: "warning"
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      showToast({
        title: "Invalid Email Format",
        message: "Please enter a valid, active email address.",
        type: "error"
      });
      return;
    }

    if (password.length < 8) {
      showToast({
        title: "Weak Password",
        message: "Password must be at least 8 characters long.",
        type: "warning"
      });
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        const res = await authApi.signUp(
          email.trim().toLowerCase(),
          password,
          name.trim(),
        );
        const data = res.data as any;
        const token = data?.token || data?.session?.token;
        const user = data?.user;
        if (token && user) {
          await authService.saveSession({
            token,
            user,
            expiresAt:
              data?.session?.expiresAt ||
              new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          });
          showToast({
            title: "Access Granted",
            message: `Successfully logged in as ${email.trim()}`,
            type: "success"
          });
          onLoginSuccess?.();
          navigation.replace("Main");
        } else {
          // Succeeded, but requireEmailVerification is active so no session token is returned yet!
          showDialog({
            title: "Verification Required",
            message: `Account created successfully!\n\nWe have sent an activation link to your email address: "${email.trim()}". Please check your inbox and click the link to activate your account.`,
            buttons: [{ text: "Got It", onPress: () => toggleAuthMode(false) }],
          });
        }
      } else {
        const res = await authApi.signIn(email.trim().toLowerCase(), password);
        const data = res.data as any;
        const token = data?.token || data?.session?.token;
        const user = data?.user;
        if (token && user) {
          await authService.saveSession({
            token,
            user,
            expiresAt:
              data?.session?.expiresAt ||
              new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          });
          showToast({
            title: "Welcome Back",
            message: `Successfully signed in as ${user.name || email.trim()}`,
            type: "success"
          });
          onLoginSuccess?.();
          navigation.replace("Main");
        } else {
          throw new Error("Missing session information");
        }
      }
    } catch (err: any) {
      console.error(
        `[Auth] ${isRegister ? "Sign-up" : "Sign-in"} error:`,
        err?.response?.data || err.message,
      );
      const responseData = err?.response?.data;

      // Check for Better-Auth unverified email error code
      if (
        responseData?.code === "EMAIL_NOT_VERIFIED" ||
        responseData?.message?.includes("verified") ||
        responseData?.error === "EMAIL_NOT_VERIFIED" ||
        err?.message?.includes("verified")
      ) {
        showDialog({
          title: "Verify Email",
          message: `Your email address "${email.trim()}" has not been verified yet.\n\nPlease check your inbox and click the verification link we sent you to activate your account.`,
          buttons: [{ text: "Got it" }],
        });
        return;
      }

      const errMsg = cleanErrorMessage(
        responseData?.message || responseData?.error,
        "Invalid credentials or connection issue."
      );
      showToast({
        title: "Auth Failure",
        message: errMsg,
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      showToast({
        title: "Opening Google Sign-In",
        message: "Launching secure Google authentication...",
        type: "info",
        duration: 4000,
      });

      const redirectUri = Linking.createURL("auth-callback");
      const { data, error } = await betterAuthClient.signIn.social({
        provider: "google",
        callbackURL: redirectUri,
      });

      // The @better-auth/expo plugin handles the OAuth browser redirect
      // and stores the session in SecureStore. After the browser closes,
      // we must call getSession() to read the actual session — the return
      // value of signIn.social() will not contain it.

      showToast({
        title: "Verifying Account",
        message: "Confirming your Google identity...",
        type: "info",
        duration: 3000,
      });

      // Give SecureStore a moment to persist the session from the redirect
      await new Promise((resolve) => setTimeout(resolve, 500));

      const sessionData = await betterAuthClient.getSession();
      const session = (sessionData as any)?.data;

      if (session?.session && session?.user) {
        // Synchronize better-auth session with our local SecureStore session
        await authService.saveSession({
          token: session.session.token,
          user: session.user as any,
          expiresAt:
            typeof session.session.expiresAt === "string"
              ? session.session.expiresAt
              : new Date(session.session.expiresAt).toISOString(),
        });

        showToast({
          title: "Welcome!",
          message: `Signed in as ${session.user.name || session.user.email}`,
          type: "success",
          duration: 3000,
        });

        onLoginSuccess?.();
        navigation.replace("Main");
      } else if (error) {
        console.error("[Auth] Google Sign-in Error:", error);
        showToast({
          title: "Google Login Failed",
          message: error.message || "Failed to authenticate with Google. Please try again.",
          type: "error",
        });
      } else {
        // Browser was likely dismissed without completing sign-in
        showToast({
          title: "Sign-In Cancelled",
          message: "Google sign-in was cancelled or did not complete.",
          type: "warning",
        });
      }
    } catch (e: any) {
      console.error("[Auth] Google exception:", e);
      showToast({
        title: "Authentication Error",
        message: "Could not complete Google sign-in. Please try again.",
        type: "error",
      });
    }
  };


  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      className="bg-background"
    >
      {/* Premium Dark Gradient Header Visual */}
      <View className="relative h-[260px] w-full items-center justify-center bg-[#0B0F1A] overflow-hidden">
        {/* Ambient Glow backdrops */}
        <View className="absolute -top-20 -left-10 w-72 h-72 rounded-full bg-primary/10 blur-[60px]" />
        <View className="absolute -bottom-20 -right-10 w-72 h-72 rounded-full bg-secondary/10 blur-[60px]" />

        {/* Floating Logo (no white card, direct overlay) */}
        <View className="items-center justify-center mt-6">
          <Image 
            source={{ uri: 'https://ik.imagekit.io/v6xwevpjp/Veriq/Somiq/somiq-no-bg-logo.png?tr=w-512,q-80,f-png' }}
            style={{ width: 220, height: 75 }}
            resizeMode="contain"
          />
          <Text className="text-text-muted font-body text-xs mt-3 uppercase tracking-widest font-semibold opacity-85">
            Fact-Check Anything Instantly
          </Text>
        </View>
      </View>

      {/* Inputs & Action Form */}
      <View className="px-6 pb-12 -mt-8">
        {/* Glassmorphic Container Card */}
        <View className="rounded-3xl p-7 border-2 border-border shadow-2xl bg-surface/90">
          {/* Toggle Login/Register */}
          <View className="flex-row mb-8 bg-surface-inner rounded-3xl p-1.5 border-2 border-border">
            <TouchableOpacity
              className="flex-1 py-3.5 rounded-2xl items-center"
              style={{
                backgroundColor: !isRegister ? colors.surface.high : 'transparent',
                borderWidth: !isRegister ? 1.5 : 0,
                borderColor: !isRegister ? colors.text.outline : 'transparent',
              }}
              onPress={() => toggleAuthMode(false)}
            >
              <Text
                className="font-headline text-base font-bold"
                style={{
                  color: !isRegister ? colors.primary : colors.text.outline,
                }}
              >
                Login
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 py-3.5 rounded-2xl items-center"
              style={{
                backgroundColor: isRegister ? colors.surface.high : 'transparent',
                borderWidth: isRegister ? 1.5 : 0,
                borderColor: isRegister ? colors.text.outline : 'transparent',
              }}
              onPress={() => toggleAuthMode(true)}
            >
              <Text
                className="font-headline text-base font-bold"
                style={{
                  color: isRegister ? colors.primary : colors.text.outline,
                }}
              >
                Register
              </Text>
            </TouchableOpacity>
          </View>

          {/* Full Name Input (Register Only) */}
          {isRegister && (
            <View className="mb-6">
              <Text className="text-text-muted font-body text-sm font-semibold mb-3 pl-3">
                Full Name
              </Text>
              <View className="relative justify-center">
                <View className="absolute z-10" style={{ left: 20, top: 17, elevation: 3 }}>
                  <MaterialIcons
                    name="person"
                    size={22}
                    color={nameFocused ? colors.primary : colors.text.outline}
                  />
                </View>
                <TextInput
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                  style={{
                    borderColor: nameFocused ? colors.primary : (colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(26, 26, 26, 0.15)'),
                    shadowColor: colors.primary,
                    shadowOffset: { width: nameFocused ? 2 : 0, height: nameFocused ? 2 : 0 },
                    shadowOpacity: nameFocused ? (colorScheme === 'dark' ? 0.3 : 1) : 0,
                    shadowRadius: 0,
                    elevation: nameFocused ? 2 : 0,
                  }}
                  className="h-14 rounded-2xl pl-14 pr-4 border text-text bg-surface-inner font-body text-[15px] transition-all duration-200"
                  placeholder="John Doe"
                  placeholderTextColor={colors.text.outline}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  editable={!loading}
                />
              </View>
            </View>
          )}

          {/* Email Input */}
          <View className="mb-6">
            <Text className="text-text-muted font-body text-sm font-semibold mb-3 pl-3">
              Email Address
            </Text>
            <View className="relative justify-center">
              <View className="absolute z-10" style={{ left: 20, top: 17, elevation: 3 }}>
                <MaterialIcons
                  name="email"
                  size={22}
                  color={emailFocused ? colors.primary : colors.text.outline}
                />
              </View>
              <TextInput
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                style={{
                  borderColor: emailFocused ? colors.primary : (colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(26, 26, 26, 0.15)'),
                  shadowColor: colors.primary,
                  shadowOffset: { width: emailFocused ? 2 : 0, height: emailFocused ? 2 : 0 },
                  shadowOpacity: emailFocused ? (colorScheme === 'dark' ? 0.3 : 1) : 0,
                  shadowRadius: 0,
                  elevation: emailFocused ? 2 : 0,
                }}
                className="h-14 rounded-2xl pl-14 pr-4 border text-text bg-surface-inner font-body text-[15px] transition-all duration-200"
                placeholder="name@company.com"
                placeholderTextColor={colors.text.outline}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
              />
            </View>
          </View>

          {/* Password Input */}
          <View className="mb-8">
            <Text className="text-text-muted font-body text-sm font-semibold mb-3 pl-3">
              Password
            </Text>
            <View className="relative justify-center">
              <View className="absolute z-10" style={{ left: 20, top: 17, elevation: 3 }}>
                <MaterialIcons
                  name="lock"
                  size={22}
                  color={passwordFocused ? colors.primary : colors.text.outline}
                />
              </View>
              <TextInput
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                style={{
                  borderColor: passwordFocused ? colors.primary : (colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(26, 26, 26, 0.15)'),
                  shadowColor: colors.primary,
                  shadowOffset: { width: passwordFocused ? 2 : 0, height: passwordFocused ? 2 : 0 },
                  shadowOpacity: passwordFocused ? (colorScheme === 'dark' ? 0.3 : 1) : 0,
                  shadowRadius: 0,
                  elevation: passwordFocused ? 2 : 0,
                }}
                className="h-14 rounded-2xl pl-14 pr-14 border text-text bg-surface-inner font-body text-[15px] transition-all duration-200"
                placeholder="••••••••"
                placeholderTextColor={colors.text.outline}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!loading}
              />
              <TouchableOpacity
                className="absolute z-10"
                style={{ right: 20, top: 17, elevation: 3 }}
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={showPassword ? "visibility" : "visibility-off"}
                  size={22}
                  color={colors.text.outline}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Primary CTA button */}
          <Button
            onPress={handleAuth}
            disabled={loading}
            loading={loading}
            variant="primary"
            size="lg"
            className="w-full mb-5"
            icon={
              <MaterialIcons
                name={isRegister ? "person" : "login"}
                size={22}
                color={colorScheme === 'dark' ? colors.background : '#1A1A1A'}
              />
            }
            title={isRegister ? "Create Account" : "Sign In"}
          />

          {/* Divider */}
          <View className="flex-row items-center my-6">
            <View className="flex-1 h-[1px] bg-border/10" />
            <Text className="text-text-outline font-body text-xs mx-4 uppercase font-semibold">
              or
            </Text>
            <View className="flex-1 h-[1px] bg-border/10" />
          </View>

          {/* Google Auth Button */}
          <Button
            onPress={handleGoogleAuth}
            disabled={loading}
            variant="secondary"
            size="md"
            className="w-full mb-4"
            icon={<GoogleIcon size={20} />}
            title="Continue with Google"
          />
        </View>
      </View>
    </ScrollView>
  );
}
