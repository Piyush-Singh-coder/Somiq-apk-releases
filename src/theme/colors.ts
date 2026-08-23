import { Appearance } from 'react-native';
import { colorScheme } from 'nativewind';

function isDark() {
  const current = colorScheme.get();
  if (!current) {
    return Appearance.getColorScheme() === 'dark';
  }
  return current === 'dark';
}

const lightColors = {
  primary: "#034F46",
  secondary: "#046A5E",
  tertiary: "#02342E",
  background: "#FCFAF2",
  accentLavender: "#EBD7FF",
  accentLavenderHover: "#DEBDFC",
  surface: {
    DEFAULT: "#FFFFFF",
    container: "#FFFFFF",
    high: "#FFFFFF",
    highest: "#F5F3E8",
    bright: "#FAF8F0",
    darkest: "#F5F3E8",
  },
  text: {
    DEFAULT: "#1A1A1A",
    muted: "#4A4A4A",
    outline: "#808080",
    dark: "#B0B0B0",
  },
  error: {
    DEFAULT: "#F43F5E",
    dark: "#F43F5E",
    text: "#F43F5E",
  }
};

const darkColors = {
  primary: "#38BDF8",
  secondary: "#0EA5E9",
  tertiary: "#0284C7",
  background: "#0B0F1A",
  accentLavender: "#EBD7FF",
  accentLavenderHover: "#DEBDFC",
  surface: {
    DEFAULT: "#111827",
    container: "#111827",
    high: "#1A2238",
    highest: "#1A2238",
    bright: "#1A2238",
    darkest: "#0F172A",
  },
  text: {
    DEFAULT: "#FFFFFF",
    muted: "#D1D5DB",
    outline: "#9CA3AF",
    dark: "#6B7280",
  },
  error: {
    DEFAULT: "#F43F5E",
    dark: "#F43F5E",
    text: "#F43F5E",
  }
};

export const colors = {
  get primary() { return isDark() ? darkColors.primary : lightColors.primary; },
  get secondary() { return isDark() ? darkColors.secondary : lightColors.secondary; },
  get tertiary() { return isDark() ? darkColors.tertiary : lightColors.tertiary; },
  get background() { return isDark() ? darkColors.background : lightColors.background; },
  get accentLavender() { return isDark() ? darkColors.accentLavender : lightColors.accentLavender; },
  get accentLavenderHover() { return isDark() ? darkColors.accentLavenderHover : lightColors.accentLavenderHover; },
  get gold() { return isDark() ? "#d5c68e" : "#B45309"; },
  get goldSoft() { return isDark() ? "#f2e2a7" : "#D97706"; },
  surface: {
    get DEFAULT() { return isDark() ? darkColors.surface.DEFAULT : lightColors.surface.DEFAULT; },
    get container() { return isDark() ? darkColors.surface.container : lightColors.surface.container; },
    get high() { return isDark() ? darkColors.surface.high : lightColors.surface.high; },
    get highest() { return isDark() ? darkColors.surface.highest : lightColors.surface.highest; },
    get bright() { return isDark() ? darkColors.surface.bright : lightColors.surface.bright; },
    get darkest() { return isDark() ? darkColors.surface.darkest : lightColors.surface.darkest; },
  },
  text: {
    get DEFAULT() { return isDark() ? darkColors.text.DEFAULT : lightColors.text.DEFAULT; },
    get muted() { return isDark() ? darkColors.text.muted : lightColors.text.muted; },
    get outline() { return isDark() ? darkColors.text.outline : lightColors.text.outline; },
    get dark() { return isDark() ? darkColors.text.dark : lightColors.text.dark; },
  },
  error: {
    get DEFAULT() { return isDark() ? darkColors.error.DEFAULT : lightColors.error.DEFAULT; },
    get dark() { return isDark() ? darkColors.error.dark : lightColors.error.dark; },
    get text() { return isDark() ? darkColors.error.text : lightColors.error.text; },
  }
};
