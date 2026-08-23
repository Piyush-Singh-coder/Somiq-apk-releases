const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Add support for .mjs and .cjs files used by better-auth
config.resolver.sourceExts.push('mjs', 'cjs');

// Enable package exports support for better-auth ESM resolution
config.resolver.unstable_enablePackageExports = true;

module.exports = withNativeWind(config, { input: "./global.css" });

