# بناء APK مستقل لتطبيق ELAN

هذا المسار ينتج ملف APK يمكن تثبيته مباشرة على Android بدون Expo Go وبدون Google Play. البناء مجاني باستخدام Android Studio، لكن يحتاج جهاز كمبيوتر عليه Java وAndroid SDK.

## المتطلبات

- Android Studio من الموقع الرسمي لـ Android Developers.
- فتح مجلد المشروع الكامل، وليس مجلد `artifacts/elan-mobile` وحده، لأن التطبيق يستخدم حزم workspace المشتركة.
- تشغيل `pnpm install` من جذر المشروع.

## إعداد متغيرات البناء

قبل البناء، استخدم عنوان الإنتاج الحالي لخادم التطبيق:

```bash
export EXPO_PUBLIC_DOMAIN=arabic-order-and-wallet-manager--fadialaa6407.replit.app
```

يجب أيضًا توفير **قيمة** مفتاح Clerk من Replit Secrets في متغير البيئة التالي. لا تضع المفتاح في ملفات المشروع ولا ترسله في المحادثة:

```bash
export EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY="قيمة-CLERK_PUBLISHABLE_KEY-من-Replit-Secrets"
```

إذا كانت بيئة Clerk لديك تستخدم Proxy، أضف متغيره أيضًا:

```bash
export EXPO_PUBLIC_CLERK_PROXY_URL="رابط-CLERK-Proxy-الإنتاجي"
```

## إنشاء APK

من جذر المشروع:

```bash
pnpm install
bash artifacts/elan-mobile/scripts/build-apk.sh
```

سيظهر الملف هنا:

```text
artifacts/elan-mobile/android/app/build/outputs/apk/release/app-release.apk
```

## التثبيت على الهاتف

1. انقل `app-release.apk` إلى الهاتف.
2. افتح الملف.
3. اسمح لمتصفح الملفات بتثبيت التطبيقات من هذا المصدر عند طلب Android.
4. ثبّت التطبيق وافتح **ELAN**.

ملف الإصدار الحالي موقّع بمفتاح Android التجريبي المولّد للمشروع، وهو مناسب للتثبيت الداخلي. قبل التوزيع خارج نطاق الشريكين يجب استبداله بمفتاح توقيع خاص محفوظ بأمان؛ لا تفقد هذا المفتاح لأن تحديثات APK المستقبلية تحتاج التوقيع نفسه.