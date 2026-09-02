#!/usr/bin/env bash
set -euo pipefail

required_vars=(
  EXPO_PUBLIC_DOMAIN
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
)

for variable in "${required_vars[@]}"; do
  if [[ -z "${!variable:-}" ]]; then
    echo "Missing required environment variable: ${variable}" >&2
    exit 1
  fi
done

cd "$(dirname "$0")/.."
echo "Building standalone ELAN APK against https://${EXPO_PUBLIC_DOMAIN}"
cd android
./gradlew assembleRelease

echo
echo "APK ready:"
echo "android/app/build/outputs/apk/release/app-release.apk"