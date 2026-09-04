# ELAN Mobile - EAS Ready

This patch adds EAS Build configuration for the existing Expo mobile app.

Production API:
https://elan-api-uz1u.onrender.com

## Android APK
From:
artifacts/elan-mobile

Run:
pnpm install
npx eas login
npx eas init
npx eas build -p android --profile preview

The preview profile produces an installable APK.

## Google Play
Use:
npx eas build -p android --profile production

The production profile produces an AAB suitable for Google Play.

Important:
- The existing mobile app already uses bearer-token authentication and SecureStore.
- Do not put private secrets in EXPO_PUBLIC_* variables.
