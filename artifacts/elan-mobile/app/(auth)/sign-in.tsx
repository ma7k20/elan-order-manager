import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { AppLogo, Field, PrimaryButton } from '@/components/elan-ui';
import { useColors } from '@/hooks/useColors';
import { useMobileAuth } from '@/lib/auth';
import { Text, View } from 'react-native';

export default function SignInScreen() {
  const colors = useColors();
  const router = useRouter();
  const { login } = useMobileAuth();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setMessage('');
    setSubmitting(true);
    try {
      await login(phone, pin);
      router.replace('/(tabs)');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر تسجيل الدخول.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAwareScrollViewCompat contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background }}>
      <View style={{ width: '100%', maxWidth: 430, alignSelf: 'center' }}>
        <AppLogo />
        <Text style={{ color: colors.foreground, fontSize: 30, fontWeight: '800', marginTop: 34 }}>الدخول إلى ELAN</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 23, marginTop: 7, marginBottom: 24 }}>
          أدخل رقم الهاتف ورمز PIN الخاص بحسابك.
        </Text>
        <Field label="رقم الهاتف" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoCapitalize="none" placeholder="05XXXXXXXX" />
        <Field label="رمز PIN" value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry placeholder="4 إلى 8 أرقام" />
        {message ? <Text style={{ color: colors.destructive, marginBottom: 13, lineHeight: 20, textAlign: 'right' }}>{message}</Text> : null}
        <PrimaryButton title={submitting ? 'جارٍ الدخول...' : 'تسجيل الدخول'} onPress={submit} disabled={!phone || pin.length < 4 || submitting} icon="log-in" />
        <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 20, marginTop: 18, textAlign: 'center' }}>
          الحسابات الجديدة تُضاف من صفحة الإعدادات بواسطة فادي أو محمود.
        </Text>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}