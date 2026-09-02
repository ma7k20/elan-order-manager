import { useSignIn } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { AppLogo, Field, PrimaryButton, styles } from '@/components/elan-ui';
import { useColors } from '@/hooks/useColors';
import { Text, View } from 'react-native';

export default function SignInScreen() {
  const colors = useColors();
  const router = useRouter();
  const { isLoaded, signIn, setActive } = useSignIn();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const submit = async () => {
    setMessage('');
    if (!isLoaded || !signIn) return;
    try {
      const created = await signIn.create({ identifier: emailAddress.trim() });
      const result = await created.attemptFirstFactor({ strategy: 'password', password });
      if (result.status === 'complete' && result.createdSessionId) {
        await setActive?.({ session: result.createdSessionId });
        router.replace('/(tabs)');
      } else {
        setMessage('يحتاج الحساب إلى خطوة تحقق إضافية.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'بيانات الدخول غير صحيحة.');
    }
  };

  return (
    <KeyboardAwareScrollViewCompat contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background }}>
      <View style={{ width: '100%', maxWidth: 430, alignSelf: 'center' }}>
        <AppLogo />
        <Text style={{ color: colors.foreground, fontSize: 30, fontWeight: '800', marginTop: 34 }}>أهلاً بعودتك</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 23, marginTop: 7, marginBottom: 24 }}>سجّل الدخول للوصول إلى مساحة ELAN الخاصة.</Text>
        <Field label="البريد الإلكتروني" value={emailAddress} onChangeText={setEmailAddress} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <Field label="كلمة المرور" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
        {message ? <Text style={{ color: colors.destructive, marginBottom: 13, lineHeight: 20 }}>{message}</Text> : null}
        <PrimaryButton title="تسجيل الدخول" onPress={submit} disabled={!emailAddress || !password || !isLoaded} icon="arrow-left" />
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 22 }}>
          <Text style={{ color: colors.mutedForeground }}>ليس لديك حساب؟</Text>
          <Link href="/sign-up" style={{ color: colors.primary, fontWeight: '800' }}>إنشاء حساب</Link>
        </View>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}