import { Feather } from '@expo/vector-icons';
import { useGetSettings, useUpdateSettings } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Card, ErrorState, Field, Header, LoadingState, PrimaryButton } from '@/components/elan-ui';
import { useColors } from '@/hooks/useColors';

export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const settings = useGetSettings();
  const update = useUpdateSettings();
  const [businessName, setBusinessName] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('ILS');
  const [initialPaymentPercent, setInitialPaymentPercent] = useState('');
  const [defaultDeliveryFee, setDefaultDeliveryFee] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!settings.data) return;
    setBusinessName(settings.data.businessName);
    setDefaultCurrency(settings.data.defaultCurrency);
    setInitialPaymentPercent(String(settings.data.initialPaymentPercent));
    setDefaultDeliveryFee(String(settings.data.defaultDeliveryFee));
  }, [settings.data]);

  const save = () => {
    const percent = Number(initialPaymentPercent);
    const fee = Number(defaultDeliveryFee);
    if (!businessName.trim() || !defaultCurrency.trim() || !Number.isFinite(percent) || percent < 0 || percent > 100 || !Number.isFinite(fee) || fee < 0) {
      setMessage('تحقق من اسم النشاط والعملة ونسبة الدفعة ورسوم التوصيل.');
      return;
    }
    setMessage('');
    update.mutate({ data: { businessName: businessName.trim(), defaultCurrency: defaultCurrency.trim().toUpperCase(), initialPaymentPercent: percent, defaultDeliveryFee: fee } }, {
      onSuccess: () => { queryClient.invalidateQueries(); setMessage('تم حفظ الإعدادات بنجاح.'); },
      onError: () => setMessage('تعذر حفظ الإعدادات. تحقق من الاتصال وحاول مجدداً.'),
    });
  };

  if (settings.isLoading) return <View style={{ flex: 1, backgroundColor: colors.background }}><LoadingState /></View>;
  if (settings.isError) return <View style={{ flex: 1, backgroundColor: colors.background, padding: 18 }}><ErrorState onRetry={() => settings.refetch()} /></View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 18, paddingBottom: 110 }}>
      <Header title="الإعدادات" subtitle="القيم الافتراضية المشتركة بين الهاتف والويب" />
      <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 14 }}><Feather name="arrow-right" size={17} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: '700' }}>العودة لإدارة العمل</Text></Pressable>
      <Card>
        <Field label="اسم النشاط" value={businessName} onChangeText={setBusinessName} placeholder="ELAN" />
        <Field label="العملة الافتراضية" value={defaultCurrency} onChangeText={setDefaultCurrency} placeholder="ILS" autoCapitalize="characters" />
        <Field label="نسبة الدفعة الأولى %" value={initialPaymentPercent} onChangeText={setInitialPaymentPercent} keyboardType="decimal-pad" placeholder="50" />
        <Field label="رسوم التوصيل الافتراضية" value={defaultDeliveryFee} onChangeText={setDefaultDeliveryFee} keyboardType="decimal-pad" placeholder="0" />
        {message ? <Text style={{ color: message.startsWith('تم') ? colors.success : colors.destructive, marginBottom: 14, textAlign: 'right' }}>{message}</Text> : null}
        <PrimaryButton title={update.isPending ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'} onPress={save} disabled={update.isPending} icon="save" />
      </Card>
    </ScrollView>
  );
}