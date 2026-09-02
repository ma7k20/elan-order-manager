import { useCreatePayment, useGetWallet, useListCustomers, useListPayments } from '@workspace/api-client-react';
import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Card, EmptyState, ErrorState, Field, Header, LoadingState, Money, PrimaryButton, SectionTitle, StatCard, formatDate } from '@/components/elan-ui';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import { useQueryClient } from '@tanstack/react-query';

export default function FinanceScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const wallet = useGetWallet();
  const payments = useListPayments();
  const customers = useListCustomers();
  const create = useCreatePayment();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('نقدي');
  const [message, setMessage] = useState('');

  const save = () => {
    if (!customerId) return;
    setMessage('');
    create.mutate({ data: { customerId, amount: Number(amount), type: 'partial', method, paymentDate: new Date().toISOString().slice(0, 10) } }, {
      onSuccess: () => { queryClient.invalidateQueries(); setOpen(false); setAmount(''); setCustomerId(null); },
      onError: () => setMessage('تعذر تسجيل الدفعة. تحقق من الرصيد والاتصال.'),
    });
  };

  if (wallet.isLoading || payments.isLoading || customers.isLoading) return <View style={{ flex: 1, backgroundColor: colors.background }}><LoadingState /></View>;
  if (wallet.isError || payments.isError || customers.isError) return <View style={{ flex: 1, backgroundColor: colors.background, padding: 18 }}><ErrorState onRetry={() => { wallet.refetch(); payments.refetch(); customers.refetch(); }} /></View>;
  const transactions = payments.data || [];
  return (
    <>
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 18, paddingBottom: 110 }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={wallet.isFetching || payments.isFetching} onRefresh={() => { wallet.refetch(); payments.refetch(); }} tintColor={colors.primary} />}>
        <Header title="المالية" subtitle="المحفظة والمدفوعات المشتركة" action={<Pressable onPress={() => setOpen(true)} style={({ pressed }) => ({ backgroundColor: colors.primary, width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.75 : 1 })}><Feather name="plus" size={21} color={colors.primaryForeground} /></Pressable>} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <StatCard label="الرصيد الحالي" value={`${Number(wallet.data?.balance || 0).toFixed(2)} ₪`} tone="primary" icon="credit-card" />
          <StatCard label="إجمالي الدخل" value={`${Number(wallet.data?.totalIncome || 0).toFixed(2)} ₪`} tone="gold" icon="trending-up" />
        </View>
        <SectionTitle title="آخر المدفوعات" />
        {transactions.length ? transactions.slice(0, 20).map((payment) => (
          <Card key={payment.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontWeight: '800' }}>{payment.customerName}</Text>
                <Text style={{ color: colors.mutedForeground, marginTop: 5 }}>{payment.method} · {formatDate(payment.paymentDate)}</Text>
              </View>
              <Text style={{ color: colors.success, fontSize: 17, fontWeight: '800' }}>+<Money value={payment.amount} /></Text>
            </View>
          </Card>
        )) : <EmptyState title="لا توجد دفعات" description="سجّل دفعة جديدة لتحديث المتبقي فوراً في الطلبات." icon="dollar-sign" />}
      </ScrollView>
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
          <KeyboardAwareScrollViewCompat contentContainerStyle={{ padding: 20, paddingBottom: 35, backgroundColor: colors.card, borderTopLeftRadius: 26, borderTopRightRadius: 26 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <Text style={{ color: colors.foreground, fontSize: 21, fontWeight: '800' }}>تسجيل دفعة</Text>
              <Pressable onPress={() => setOpen(false)}><Feather name="x" size={23} color={colors.mutedForeground} /></Pressable>
            </View>
            <Text style={{ color: colors.foreground, fontWeight: '700', marginBottom: 9 }}>اختر العميل</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 14 }}>
              {(customers.data || []).map((customer) => (
                <Pressable key={customer.id} onPress={() => setCustomerId(customer.id)} style={{ paddingHorizontal: 13, paddingVertical: 10, borderRadius: 13, borderWidth: 1, borderColor: customerId === customer.id ? colors.primary : colors.border, backgroundColor: customerId === customer.id ? colors.secondary : colors.background }}>
                  <Text style={{ color: colors.foreground, fontWeight: '700' }}>{customer.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Field label="المبلغ" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
            <Field label="طريقة الدفع" value={method} onChangeText={setMethod} placeholder="نقدي، تحويل..." />
            {message ? <Text style={{ color: colors.destructive, marginBottom: 12 }}>{message}</Text> : null}
            <PrimaryButton title={create.isPending ? 'جارٍ التسجيل...' : 'تأكيد الدفعة'} onPress={save} disabled={!customerId || Number(amount) <= 0 || create.isPending} icon="check" />
          </KeyboardAwareScrollViewCompat>
        </View>
      </Modal>
    </>
  );
}