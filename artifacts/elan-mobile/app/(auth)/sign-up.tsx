import { useSignUp } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { AppLogo, Field, PrimaryButton } from '@/components/elan-ui';
import { useColors } from '@/hooks/useColors';
import { Text, View } from 'react-native';

export default function SignUpScreen() {
  const colors = useColors();
  const router = useRouter();
  const { isLoaded, signUp, setActive } = useSignUp();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [verificationStarted, setVerificationStarted] = useState(false);
  const verifying = verificationStarted;

  const submit = async () => {
    setMessage('');
    if (!isLoaded || !signUp) return;
    try {
      await signUp.create({ emailAddress: emailAddress.trim(), password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setVerificationStarted(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر إنشاء الحساب.');
    }
  };

  const verify = async () => {
    setMessage('');
    if (!isLoaded || !signUp) return;
    try {
      const result = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (result.status === 'complete' && result.createdSessionId) {
        await setActive?.({ session: result.createdSessionId });
        router.replace('/(tabs)');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'رمز التحقق غير صحيح.');
    }
  };

  return (
    <KeyboardAwareScrollViewCompat contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background }}>
      <View style={{ width: '100%', maxWidth: 430, alignSelf: 'center' }}>
        <AppLogo />
        <Text style={{ color: colors.foreground, fontSize: 30, fontWeight: '800', marginTop: 34 }}>{verifying ? 'تحقق من البريد' : 'إنشاء حساب'}</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 23, marginTop: 7, marginBottom: 24 }}>
          {verifying ? 'أرسلنا رمز تحقق إلى بريدك الإلكتروني.' : 'أنشئ حسابك ثم اطلب تفعيل الوصول إلى مساحة ELAN.'}
        </Text>
        {verifying ? (
          <>
            <Field label="رمز التحقق" value={code} onChangeText={setCode} keyboardType="number-pad" />
            <PrimaryButton title="تأكيد البريد" onPress={verify} disabled={!code || !isLoaded} icon="check" />
          </>
        ) : (
          <>
            <Field label="البريد الإلكتروني" value={emailAddress} onChangeText={setEmailAddress} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            <Field label="كلمة المرور" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
            <PrimaryButton title="إرسال رمز التحقق" onPress={submit} disabled={!emailAddress || !password || !isLoaded} icon="arrow-left" />
          </>
        )}
        {message ? <Text style={{ color: colors.destructive, marginTop: 13, lineHeight: 20 }}>{message}</Text> : null}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 22 }}>
          <Text style={{ color: colors.mutedForeground }}>لديك حساب؟</Text>
          <Link href="/sign-in" style={{ color: colors.primary, fontWeight: '800' }}>تسجيل الدخول</Link>
        </View>
        <View nativeID="clerk-captcha" />
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}