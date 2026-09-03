import { useCreatePayment, useCreateWalletTransaction, useDeletePayment, useDeleteWalletTransaction, useGetWallet, useListCustomers, useListPayments, useUpdatePayment, useUpdateWalletTransaction } from '@workspace/api-client-react';
import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
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
  const updatePayment = useUpdatePayment();
  const deletePayment = useDeletePayment();
  const createExpense = useCreateWalletTransaction();
  const updateExpense = useUpdateWalletTransaction();
  const deleteExpense = useDeleteWalletTransaction();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'payment' | 'expense'>('payment');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('نقدي');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('مصروف عام');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState('');

  const save = () => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setMessage('أدخل مبلغاً صحيحاً.'); return; }
    setMessage('');
    const done = { onSuccess: () => { queryClient.invalidateQueries(); close(); }, onError: () => setMessage('تعذر حفظ العملية. تحقق من البيانات والاتصال.') };
    if (mode === 'expense') {
      if (!description.trim() || !category.trim()) { setMessage('أدخل وصف المصروف وتصنيفه.'); return; }
      const data = { type: 'expense' as const, amount: numericAmount, category: category.trim(), description: description.trim(), transactionDate };
      if (editingId) updateExpense.mutate({ id: editingId, data }, done);
      else createExpense.mutate({ data }, done);
      return;
    }
    if (!customerId) return;
    const data = { customerId, amount: numericAmount, type: 'partial' as const, method, paymentDate: transactionDate };
    if (editingId) updatePayment.mutate({ id: editingId, data }, done);
    else create.mutate({ data }, {
      onSuccess: () => { queryClient.invalidateQueries(); close(); },
      onError: () => setMessage('تعذر تسجيل الدفعة. تحقق من الرصيد والاتصال.'),
    });
  };
  const close = () => { setOpen(false); setEditingId(null); setCustomerId(null); setAmount(''); setMethod('نقدي'); setDescription(''); setCategory('مصروف عام'); setTransactionDate(new Date().toISOString().slice(0, 10)); setMessage(''); };
  const editPayment = (payment: (typeof transactions)[number]) => { setMode('payment'); setEditingId(payment.id); setCustomerId(payment.customerId); setAmount(String(payment.amount)); setMethod(payment.method); setTransactionDate(payment.paymentDate); setOpen(true); };
  const editExpense = (expense: NonNullable<typeof wallet.data>['transactions'][number]) => { setMode('expense'); setEditingId(expense.id); setAmount(String(expense.amount)); setCategory(expense.category); setDescription(expense.description); setTransactionDate(expense.transactionDate); setOpen(true); };
  const confirmDeletePayment = (id: number) => Alert.alert('حذف الدفعة؟', 'سيُحذف قيدها من المحفظة أيضاً.', [{ text: 'تراجع', style: 'cancel' }, { text: 'حذف', style: 'destructive', onPress: () => deletePayment.mutate({ id }, { onSuccess: () => queryClient.invalidateQueries(), onError: () => Alert.alert('تعذر الحذف', 'حاول مرة أخرى.') }) }]);
  const confirmDeleteExpense = (id: number) => Alert.alert('حذف المصروف؟', 'سيُحذف نهائياً من دفتر المحفظة.', [{ text: 'تراجع', style: 'cancel' }, { text: 'حذف', style: 'destructive', onPress: () => deleteExpense.mutate({ id }, { onSuccess: () => queryClient.invalidateQueries(), onError: () => Alert.alert('تعذر الحذف', 'الحركات المرتبطة بعملية أخرى تُدار من شاشتها الأصلية.') }) }]);

  if (wallet.isLoading || payments.isLoading || customers.isLoading) return <View style={{ flex: 1, backgroundColor: colors.background }}><LoadingState /></View>;
  if (wallet.isError || payments.isError || customers.isError) return <View style={{ flex: 1, backgroundColor: colors.background, padding: 18 }}><ErrorState onRetry={() => { wallet.refetch(); payments.refetch(); customers.refetch(); }} /></View>;
  const transactions = payments.data || [];
  return (
    <>
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 30, paddingBottom: 110 }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={wallet.isFetching || payments.isFetching} onRefresh={() => { wallet.refetch(); payments.refetch(); }} tintColor={colors.primary} />}>
        <Header title="المالية" subtitle="المحفظة والمدفوعات المشتركة" action={<Pressable onPress={() => { close(); setMode('payment'); setOpen(true); }} style={({ pressed }) => ({ backgroundColor: colors.primary, width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.75 : 1 })}><Feather name="plus" size={21} color={colors.primaryForeground} /></Pressable>} />
        <PrimaryButton title="إضافة مصروف" onPress={() => { close(); setMode('expense'); setOpen(true); }} variant="secondary" icon="minus-circle" style={{ marginBottom: 14 }} />
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
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}><PrimaryButton title="تعديل" onPress={() => editPayment(payment)} variant="secondary" icon="edit-2" style={{ flex: 1 }} /><PrimaryButton title="حذف" onPress={() => confirmDeletePayment(payment.id)} variant="danger" icon="trash-2" style={{ flex: 1 }} /></View>
          </Card>
        )) : <EmptyState title="لا توجد دفعات" description="سجّل دفعة جديدة لتحديث المتبقي فوراً في الطلبات." icon="dollar-sign" />}
        <SectionTitle title="المصاريف اليدوية" />
        {(wallet.data?.transactions || []).filter((entry) => entry.type === 'expense' && !['shein_purchase', 'shipping'].includes(entry.category)).map((expense) => <Card key={expense.id}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><View style={{ flex: 1 }}><Text style={{ color: colors.foreground, fontWeight: '800', textAlign: 'right' }}>{expense.description}</Text><Text style={{ color: colors.mutedForeground, marginTop: 5, textAlign: 'right' }}>{expense.category} · {formatDate(expense.transactionDate)}</Text></View><Text style={{ color: colors.destructive, fontWeight: '800' }}>−<Money value={expense.amount} /></Text></View><View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}><PrimaryButton title="تعديل" onPress={() => editExpense(expense)} variant="secondary" icon="edit-2" style={{ flex: 1 }} /><PrimaryButton title="حذف" onPress={() => confirmDeleteExpense(expense.id)} variant="danger" icon="trash-2" style={{ flex: 1 }} /></View></Card>)}
      </ScrollView>
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
          <KeyboardAwareScrollViewCompat contentContainerStyle={{ padding: 20, paddingBottom: 35, backgroundColor: colors.card, borderTopLeftRadius: 26, borderTopRightRadius: 26 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
               <Text style={{ color: colors.foreground, fontSize: 21, fontWeight: '800' }}>{editingId ? 'تعديل' : 'تسجيل'} {mode === 'payment' ? 'دفعة' : 'مصروف'}</Text>
               <Pressable onPress={close}><Feather name="x" size={23} color={colors.mutedForeground} /></Pressable>
            </View>
            {mode === 'payment' ? <>
            <Text style={{ color: colors.foreground, fontWeight: '700', marginBottom: 9 }}>اختر العميل</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 14 }}>
              {(customers.data || []).map((customer) => (
                <Pressable key={customer.id} onPress={() => setCustomerId(customer.id)} style={{ paddingHorizontal: 13, paddingVertical: 10, borderRadius: 13, borderWidth: 1, borderColor: customerId === customer.id ? colors.primary : colors.border, backgroundColor: customerId === customer.id ? colors.secondary : colors.background }}>
                  <Text style={{ color: colors.foreground, fontWeight: '700' }}>{customer.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            </> : <><Field label="وصف المصروف" value={description} onChangeText={setDescription} placeholder="مثال: مواد تغليف" /><Field label="التصنيف" value={category} onChangeText={setCategory} placeholder="تغليف، نقل..." /></>}
            <Field label="المبلغ" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
             {mode === 'payment' ? <Field label="طريقة الدفع" value={method} onChangeText={setMethod} placeholder="نقدي، تحويل..." /> : null}
             <Field label="التاريخ" value={transactionDate} onChangeText={setTransactionDate} placeholder="YYYY-MM-DD" />
            {message ? <Text style={{ color: colors.destructive, marginBottom: 12 }}>{message}</Text> : null}
             <PrimaryButton title={create.isPending || updatePayment.isPending || createExpense.isPending || updateExpense.isPending ? 'جارٍ الحفظ...' : 'حفظ العملية'} onPress={save} disabled={(mode === 'payment' && !customerId) || Number(amount) <= 0 || create.isPending || updatePayment.isPending || createExpense.isPending || updateExpense.isPending} icon="check" />
          </KeyboardAwareScrollViewCompat>
        </View>
      </Modal>
    </>
  );
}