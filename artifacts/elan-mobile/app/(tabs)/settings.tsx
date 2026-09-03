import { Feather } from '@expo/vector-icons';
import { useGetSettings, useUpdateSettings } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Card, ErrorState, Field, Header, LoadingState, PrimaryButton, SectionTitle } from '@/components/elan-ui';
import { useColors } from '@/hooks/useColors';
import { mobileAuthApi, type AppAccount, useMobileAuth } from '@/lib/auth';

export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { account } = useMobileAuth();
  const settings = useGetSettings();
  const update = useUpdateSettings();
  const [businessName, setBusinessName] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('ILS');
  const [initialPaymentPercent, setInitialPaymentPercent] = useState('');
  const [defaultDeliveryFee, setDefaultDeliveryFee] = useState('');
  const [message, setMessage] = useState('');
  const [accounts, setAccounts] = useState<AppAccount[]>([]);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newCanManage, setNewCanManage] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [replacementPin, setReplacementPin] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingPin, setSavingPin] = useState(false);

  const loadAccounts = async () => {
    if (!account?.canManageAccounts) return;
    try {
      setAccounts(await mobileAuthApi<AppAccount[]>('/auth/accounts'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر تحميل الحسابات.');
    }
  };

  useEffect(() => {
    if (!settings.data) return;
    setBusinessName(settings.data.businessName);
    setDefaultCurrency(settings.data.defaultCurrency);
    setInitialPaymentPercent(String(settings.data.initialPaymentPercent));
    setDefaultDeliveryFee(String(settings.data.defaultDeliveryFee));
  }, [settings.data]);

  useEffect(() => {
    void loadAccounts();
  }, [account?.canManageAccounts]);

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

  const addAccount = async () => {
    setSavingAccount(true);
    setMessage('');
    try {
      await mobileAuthApi<AppAccount>('/auth/accounts', {
        method: 'POST',
        body: JSON.stringify({ name: newName, phone: newPhone, pin: newPin, canManageAccounts: newCanManage }),
      });
      setNewName('');
      setNewPhone('');
      setNewPin('');
      setNewCanManage(false);
      setMessage('تمت إضافة الحساب بنجاح.');
      await loadAccounts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر إضافة الحساب.');
    } finally {
      setSavingAccount(false);
    }
  };

  const changePin = async () => {
    setSavingPin(true);
    setMessage('');
    try {
      await mobileAuthApi<void>('/auth/pin', {
        method: 'PATCH',
        body: JSON.stringify({ currentPin, newPin: replacementPin }),
      });
      setCurrentPin('');
      setReplacementPin('');
      setMessage('تم تغيير رمز PIN بنجاح.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر تغيير رمز PIN.');
    } finally {
      setSavingPin(false);
    }
  };

  if (settings.isLoading) return <View style={{ flex: 1, backgroundColor: colors.background }}><LoadingState /></View>;
  if (settings.isError) return <View style={{ flex: 1, backgroundColor: colors.background, padding: 18 }}><ErrorState onRetry={() => settings.refetch()} /></View>;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 30, paddingBottom: 110 }}>
      <Header title="الإعدادات" subtitle="إعدادات النشاط والحسابات المسموح لها بالدخول" />
      <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 14 }}>
        <Feather name="arrow-right" size={17} color={colors.primary} />
        <Text style={{ color: colors.primary, fontWeight: '700' }}>العودة لإدارة العمل</Text>
      </Pressable>

      {message ? <Text style={{ color: message.startsWith('تم') ? colors.success : colors.destructive, marginBottom: 14, textAlign: 'right' }}>{message}</Text> : null}

      <SectionTitle title="إعدادات النشاط" />
      <Card>
        <Field label="اسم النشاط" value={businessName} onChangeText={setBusinessName} placeholder="ELAN" />
        <Field label="العملة الافتراضية" value={defaultCurrency} onChangeText={setDefaultCurrency} placeholder="ILS" autoCapitalize="characters" />
        <Field label="نسبة الدفعة الأولى %" value={initialPaymentPercent} onChangeText={setInitialPaymentPercent} keyboardType="decimal-pad" placeholder="50" />
        <Field label="رسوم التوصيل الافتراضية" value={defaultDeliveryFee} onChangeText={setDefaultDeliveryFee} keyboardType="decimal-pad" placeholder="0" />
        <PrimaryButton title={update.isPending ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'} onPress={save} disabled={update.isPending} icon="save" />
      </Card>

      <SectionTitle title="تغيير رمز PIN" />
      <Card>
        <Field label="رمز PIN الحالي" value={currentPin} onChangeText={setCurrentPin} keyboardType="number-pad" secureTextEntry />
        <Field label="رمز PIN الجديد" value={replacementPin} onChangeText={setReplacementPin} keyboardType="number-pad" secureTextEntry placeholder="4 إلى 8 أرقام" />
        <PrimaryButton title={savingPin ? 'جارٍ التغيير...' : 'تغيير رمز PIN'} onPress={changePin} disabled={savingPin || currentPin.length < 4 || replacementPin.length < 4} icon="key" />
      </Card>

      {account?.canManageAccounts ? (
        <>
          <SectionTitle title="إضافة حساب جديد" />
          <Card>
            <Field label="اسم صاحب الحساب" value={newName} onChangeText={setNewName} />
            <Field label="رقم الهاتف" value={newPhone} onChangeText={setNewPhone} keyboardType="phone-pad" placeholder="05XXXXXXXX" />
            <Field label="رمز PIN مبدئي" value={newPin} onChangeText={setNewPin} keyboardType="number-pad" secureTextEntry placeholder="4 إلى 8 أرقام" />
            <Pressable onPress={() => setNewCanManage((value) => !value)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Feather name={newCanManage ? 'check-square' : 'square'} size={21} color={newCanManage ? colors.primary : colors.mutedForeground} />
              <Text style={{ color: colors.foreground, fontWeight: '700' }}>يستطيع إضافة وإدارة حسابات أخرى</Text>
            </Pressable>
            <PrimaryButton title={savingAccount ? 'جارٍ الإضافة...' : 'إضافة الحساب'} onPress={addAccount} disabled={savingAccount || !newName.trim() || !newPhone.trim() || newPin.length < 4} icon="user-plus" />
          </Card>

          <SectionTitle title="الحسابات المصرح لها" />
          {accounts.map((item) => (
            <Card key={item.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontWeight: '800', fontSize: 16, textAlign: 'right' }}>{item.name}</Text>
                  <Text style={{ color: colors.mutedForeground, marginTop: 5, textAlign: 'right' }}>{item.phone}</Text>
                </View>
                <View style={{ borderRadius: 12, backgroundColor: colors.muted, paddingHorizontal: 10, paddingVertical: 7 }}>
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}>{item.canManageAccounts ? 'مدير' : 'مستخدم'}</Text>
                </View>
              </View>
            </Card>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}