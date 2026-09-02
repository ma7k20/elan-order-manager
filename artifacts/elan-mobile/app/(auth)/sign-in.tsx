import { useSignIn } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { AppLogo, Field, PrimaryButton, styles } from '@/components/elan-ui';
import { useColors } from '@/hooks/useColors';
import { Pressable, Text, View } from 'react-native';

type SecondFactorStrategy = 'email_code' | 'phone_code' | 'totp' | 'backup_code';

type SecondFactorOption = {
  strategy: SecondFactorStrategy;
  label: string;
  emailAddressId?: string;
  phoneNumberId?: string;
};

export default function SignInScreen() {
  const colors = useColors();
  const router = useRouter();
  const { isLoaded, signIn, setActive } = useSignIn();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [needsSecondFactor, setNeedsSecondFactor] = useState(false);
  const [secondFactorCode, setSecondFactorCode] = useState('');
  const [secondFactorOptions, setSecondFactorOptions] = useState<SecondFactorOption[]>([]);
  const [selectedSecondFactor, setSelectedSecondFactor] = useState<SecondFactorOption | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const completeSignIn = async (sessionId: string) => {
    await setActive?.({ session: sessionId });
    router.replace('/(tabs)');
  };

  const prepareSelectedFactor = async (option: SecondFactorOption) => {
    if (!isLoaded || !signIn) return;

    setSelectedSecondFactor(option);
    setSecondFactorCode('');
    setMessage('');

    if (option.strategy === 'email_code') {
      await signIn.prepareSecondFactor({
        strategy: 'email_code',
        emailAddressId: option.emailAddressId,
      });
      setMessage('أرسلنا رمز تحقق إلى بريدك الإلكتروني.');
    } else if (option.strategy === 'phone_code') {
      await signIn.prepareSecondFactor({
        strategy: 'phone_code',
        phoneNumberId: option.phoneNumberId,
      });
      setMessage('أرسلنا رمز تحقق إلى رقم هاتفك.');
    } else if (option.strategy === 'totp') {
      setMessage('أدخل الرمز الظاهر في تطبيق المصادقة.');
    } else {
      setMessage('أدخل أحد رموز الاسترداد الاحتياطية.');
    }
  };

  const submit = async () => {
    setMessage('');
    if (!isLoaded || !signIn) return;
    setIsSubmitting(true);

    try {
      const created = await signIn.create({ identifier: emailAddress.trim() });
      const result = await created.attemptFirstFactor({ strategy: 'password', password });
      const resultStatus = result.status as string | null;

      if (resultStatus === 'complete' && result.createdSessionId) {
        await completeSignIn(result.createdSessionId);
      } else if (resultStatus === 'needs_second_factor' || resultStatus === 'needs_client_trust') {
        const options = (result.supportedSecondFactors ?? []).flatMap<SecondFactorOption>((factor) => {
          if (factor.strategy === 'email_code') {
            return [{
              strategy: 'email_code',
              label: `البريد ${factor.safeIdentifier}`,
              emailAddressId: factor.emailAddressId,
            }];
          }
          if (factor.strategy === 'phone_code') {
            return [{
              strategy: 'phone_code',
              label: `الهاتف ${factor.safeIdentifier}`,
              phoneNumberId: factor.phoneNumberId,
            }];
          }
          if (factor.strategy === 'totp') {
            return [{ strategy: 'totp', label: 'تطبيق المصادقة' }];
          }
          if (factor.strategy === 'backup_code') {
            return [{ strategy: 'backup_code', label: 'رمز احتياطي' }];
          }
          return [];
        });

        const preferred =
          options.find((option) => option.strategy === 'email_code') ??
          options.find((option) => option.strategy === 'phone_code') ??
          options.find((option) => option.strategy === 'totp') ??
          options[0];

        if (!preferred) {
          setMessage('الحساب يتطلب تحققًا إضافيًا غير مدعوم حاليًا.');
          return;
        }

        setNeedsSecondFactor(true);
        setSecondFactorOptions(options);
        setSelectedSecondFactor(preferred);

        if (preferred.strategy === 'email_code') {
          await result.prepareSecondFactor({
            strategy: 'email_code',
            emailAddressId: preferred.emailAddressId,
          });
          setMessage('أرسلنا رمز تحقق إلى بريدك الإلكتروني.');
        } else if (preferred.strategy === 'phone_code') {
          await result.prepareSecondFactor({
            strategy: 'phone_code',
            phoneNumberId: preferred.phoneNumberId,
          });
          setMessage('أرسلنا رمز تحقق إلى رقم هاتفك.');
        } else if (preferred.strategy === 'totp') {
          setMessage('أدخل الرمز الظاهر في تطبيق المصادقة.');
        } else {
          setMessage('أدخل أحد رموز الاسترداد الاحتياطية.');
        }
      } else {
        setMessage(`تعذر إكمال تسجيل الدخول (${resultStatus ?? 'حالة غير معروفة'}).`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'بيانات الدخول غير صحيحة.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifySecondFactor = async () => {
    if (!isLoaded || !signIn || !selectedSecondFactor || !secondFactorCode.trim()) return;

    setIsSubmitting(true);
    setMessage('');

    try {
      let result;
      if (selectedSecondFactor.strategy === 'email_code') {
        result = await signIn.attemptSecondFactor({
          strategy: 'email_code',
          code: secondFactorCode.trim(),
        });
      } else if (selectedSecondFactor.strategy === 'phone_code') {
        result = await signIn.attemptSecondFactor({
          strategy: 'phone_code',
          code: secondFactorCode.trim(),
        });
      } else if (selectedSecondFactor.strategy === 'totp') {
        result = await signIn.attemptSecondFactor({
          strategy: 'totp',
          code: secondFactorCode.trim(),
        });
      } else {
        result = await signIn.attemptSecondFactor({
          strategy: 'backup_code',
          code: secondFactorCode.trim(),
        });
      }

      if (result.status === 'complete' && result.createdSessionId) {
        await completeSignIn(result.createdSessionId);
      } else {
        setMessage('لم يكتمل التحقق. تأكد من الرمز وحاول مرة أخرى.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'رمز التحقق غير صحيح.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetSignIn = () => {
    setNeedsSecondFactor(false);
    setSecondFactorCode('');
    setSecondFactorOptions([]);
    setSelectedSecondFactor(null);
    setMessage('');
  };

  return (
    <KeyboardAwareScrollViewCompat contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background }}>
      <View style={{ width: '100%', maxWidth: 430, alignSelf: 'center' }}>
        <AppLogo />
        <Text style={{ color: colors.foreground, fontSize: 30, fontWeight: '800', marginTop: 34 }}>
          {needsSecondFactor ? 'التحقق الإضافي' : 'أهلاً بعودتك'}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 23, marginTop: 7, marginBottom: 24 }}>
          {needsSecondFactor ? 'أكمل خطوة الأمان لتسجيل الدخول من هذا الجهاز.' : 'سجّل الدخول للوصول إلى مساحة ELAN الخاصة.'}
        </Text>

        {needsSecondFactor ? (
          <>
            {secondFactorOptions.length > 1 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {secondFactorOptions.map((option) => {
                  const selected = selectedSecondFactor?.strategy === option.strategy;
                  return (
                    <Pressable
                      key={`${option.strategy}-${option.emailAddressId ?? option.phoneNumberId ?? ''}`}
                      onPress={() => prepareSelectedFactor(option)}
                      style={{
                        borderWidth: 1,
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? colors.muted : colors.background,
                        borderRadius: 12,
                        paddingHorizontal: 13,
                        paddingVertical: 10,
                      }}
                    >
                      <Text style={{ color: colors.foreground, fontWeight: '700' }}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <Field
              label={selectedSecondFactor?.strategy === 'backup_code' ? 'الرمز الاحتياطي' : 'رمز التحقق'}
              value={secondFactorCode}
              onChangeText={setSecondFactorCode}
              keyboardType={selectedSecondFactor?.strategy === 'backup_code' ? 'default' : 'number-pad'}
              autoCapitalize="none"
            />
            {message ? <Text style={{ color: colors.mutedForeground, marginBottom: 13, lineHeight: 20 }}>{message}</Text> : null}
            <PrimaryButton
              title="تأكيد وتسجيل الدخول"
              onPress={verifySecondFactor}
              disabled={!secondFactorCode.trim() || isSubmitting}
              icon="check-circle"
            />
            <PrimaryButton
              title="العودة"
              onPress={resetSignIn}
              disabled={isSubmitting}
              variant="secondary"
              style={{ marginTop: 10 }}
            />
          </>
        ) : (
          <>
            <Field label="البريد الإلكتروني" value={emailAddress} onChangeText={setEmailAddress} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            <Field label="كلمة المرور" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
            {message ? <Text style={{ color: colors.destructive, marginBottom: 13, lineHeight: 20 }}>{message}</Text> : null}
            <PrimaryButton title="تسجيل الدخول" onPress={submit} disabled={!emailAddress || !password || !isLoaded || isSubmitting} icon="arrow-left" />
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 22 }}>
              <Text style={{ color: colors.mutedForeground }}>ليس لديك حساب؟</Text>
              <Link href="/sign-up" style={{ color: colors.primary, fontWeight: '800' }}>إنشاء حساب</Link>
            </View>
          </>
        )}
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}