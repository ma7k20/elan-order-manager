import { Feather } from '@expo/vector-icons';
import {
  useCancelPurchase,
  useCreatePurchase,
  useDeletePurchase,
  getGetOrderQueryKey,
  useGetOrder,
  useListOrders,
  useListPurchases,
  useUpdatePurchase,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Card, EmptyState, ErrorState, Field, Header, LoadingState, Money, Pill, PrimaryButton, formatDate } from '@/components/elan-ui';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';

const today = () => new Date().toISOString().slice(0, 10);

export default function PurchasesScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const purchases = useListPurchases();
  const orders = useListOrders();
  const create = useCreatePurchase();
  const update = useUpdatePurchase();
  const cancel = useCancelPurchase();
  const remove = useDeletePurchase();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(today());
  const [totalAmount, setTotalAmount] = useState('');
  const [currency, setCurrency] = useState('ILS');
  const [notes, setNotes] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [itemIds, setItemIds] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const orderId = selectedOrderId || 0;
  const order = useGetOrder(orderId, { query: { queryKey: getGetOrderQueryKey(orderId), enabled: Boolean(selectedOrderId) } });
  const items = purchases.data || [];

  const close = () => {
    setOpen(false);
    setEditingId(null);
    setInvoiceNumber('');
    setPurchaseDate(today());
    setTotalAmount('');
    setCurrency('ILS');
    setNotes('');
    setSelectedOrderId(null);
    setItemIds([]);
    setMessage('');
  };

  const openEdit = (purchase: (typeof items)[number]) => {
    setEditingId(purchase.id);
    setInvoiceNumber(purchase.invoiceNumber);
    setPurchaseDate(purchase.purchaseDate);
    setTotalAmount(String(purchase.totalAmount));
    setCurrency(purchase.currency);
    setNotes(purchase.notes || '');
    setMessage('');
    setOpen(true);
  };

  const save = () => {
    const amount = Number(totalAmount);
    if (!invoiceNumber.trim() || !purchaseDate || !Number.isFinite(amount) || amount < 0) {
      setMessage('أدخل رقم الفاتورة والتاريخ والمبلغ بصورة صحيحة.');
      return;
    }
    const options = {
      onSuccess: () => { queryClient.invalidateQueries(); close(); },
      onError: () => setMessage('تعذر حفظ الفاتورة. تحقق من الرقم والبيانات والاتصال.'),
    };
    if (editingId) {
      update.mutate({ id: editingId, data: { invoiceNumber: invoiceNumber.trim(), purchaseDate, totalAmount: amount, currency, notes: notes.trim() || null } }, options);
    } else {
      create.mutate({ data: { invoiceNumber: invoiceNumber.trim(), purchaseDate, totalAmount: amount, currency, notes: notes.trim() || undefined, itemIds } }, options);
    }
  };

  const confirmCancel = (id: number, label: string) => Alert.alert(
    'إلغاء فاتورة SHEIN؟',
    `سيبقى سجل ${label} محفوظاً، وسيُعاد المبلغ للمحفظة محاسبياً. لا يمكن الإلغاء إذا كانت الفاتورة مرتبطة بشحنة.`,
    [
      { text: 'تراجع', style: 'cancel' },
      { text: 'إلغاء الفاتورة', style: 'destructive', onPress: () => cancel.mutate({ id, data: { reason: 'إلغاء معتمد من تطبيق الهاتف' } }, {
        onSuccess: () => queryClient.invalidateQueries(),
        onError: () => Alert.alert('تعذر الإلغاء', 'قد تكون الفاتورة ملغاة أو مرتبطة بشحنة. ألغِ الشحنة أولاً ثم حاول مجدداً.'),
      }) },
    ],
  );
  const confirmDelete = (id: number, label: string) => Alert.alert('حذف الفاتورة نهائياً؟', `سيُحذف ${label} وقيده المالي. لا يمكن الحذف إذا كانت ضمن شحنة.`, [{ text: 'تراجع', style: 'cancel' }, { text: 'حذف نهائي', style: 'destructive', onPress: () => remove.mutate({ id }, { onSuccess: () => queryClient.invalidateQueries(), onError: () => Alert.alert('تعذر الحذف', 'احذف الشحنة المرتبطة أولاً، ثم حاول مجدداً.') }) }]);

  if (purchases.isLoading || orders.isLoading) return <View style={{ flex: 1, backgroundColor: colors.background }}><LoadingState /></View>;
  if (purchases.isError || orders.isError) return <View style={{ flex: 1, backgroundColor: colors.background, padding: 18 }}><ErrorState onRetry={() => { purchases.refetch(); orders.refetch(); }} /></View>;

  return (
    <>
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 30, paddingBottom: 110 }} refreshControl={<RefreshControl refreshing={purchases.isFetching} onRefresh={() => purchases.refetch()} tintColor={colors.primary} />}>
        <Header title="مشتريات SHEIN" subtitle="الفواتير المشتركة وربط منتجات الطلبات" action={<Pressable onPress={() => { close(); setOpen(true); }} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}><Feather name="plus" size={21} color={colors.primaryForeground} /></Pressable>} />
        <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 14 }}><Feather name="arrow-right" size={17} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: '700' }}>العودة لإدارة العمل</Text></Pressable>
        {items.length ? items.map((purchase) => (
          <Card key={purchase.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: '800', textAlign: 'right' }}>{purchase.invoiceNumber}</Text>
                <Text style={{ color: colors.mutedForeground, marginTop: 5, textAlign: 'right' }}>{formatDate(purchase.purchaseDate)} · {purchase.itemIds.length} منتج</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Pill tone={purchase.status === 'cancelled' ? 'danger' : 'success'}>{purchase.status === 'cancelled' ? 'ملغاة' : 'مشتراة'}</Pill>
                <Text style={{ color: colors.primary, fontWeight: '800', marginTop: 9 }}><Money value={purchase.totalAmount} currency={purchase.currency} /></Text>
              </View>
            </View>
            {purchase.notes ? <Text style={{ color: colors.mutedForeground, marginTop: 12, textAlign: 'right' }}>{purchase.notes}</Text> : null}
            {purchase.status !== 'cancelled' ? <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <PrimaryButton title="تعديل" onPress={() => openEdit(purchase)} variant="secondary" icon="edit-2" style={{ flex: 1 }} />
              <PrimaryButton title="إلغاء آمن" onPress={() => confirmCancel(purchase.id, purchase.invoiceNumber)} variant="danger" icon="x-circle" style={{ flex: 1 }} disabled={cancel.isPending} />
            </View> : null}
            <PrimaryButton title="حذف نهائي" onPress={() => confirmDelete(purchase.id, purchase.invoiceNumber)} variant="danger" icon="trash-2" style={{ marginTop: 8 }} disabled={remove.isPending} />
          </Card>
        )) : <EmptyState title="لا توجد مشتريات" description="سجّل أول فاتورة SHEIN واربطها بمنتجات الطلبات." icon="shopping-bag" />}
      </ScrollView>
      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
          <KeyboardAwareScrollViewCompat contentContainerStyle={{ padding: 20, paddingBottom: 35, backgroundColor: colors.card, borderTopLeftRadius: 26, borderTopRightRadius: 26 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}><Text style={{ color: colors.foreground, fontSize: 21, fontWeight: '800' }}>{editingId ? 'تعديل الفاتورة' : 'فاتورة SHEIN جديدة'}</Text><Pressable onPress={close}><Feather name="x" size={23} color={colors.mutedForeground} /></Pressable></View>
            <Field label="رقم الفاتورة" value={invoiceNumber} onChangeText={setInvoiceNumber} placeholder="SH-2026-001" />
            <Field label="تاريخ الشراء" value={purchaseDate} onChangeText={setPurchaseDate} placeholder="YYYY-MM-DD" />
            <View style={{ flexDirection: 'row', gap: 9 }}><View style={{ flex: 2 }}><Field label="إجمالي المبلغ" value={totalAmount} onChangeText={setTotalAmount} keyboardType="decimal-pad" placeholder="0.00" /></View><View style={{ flex: 1 }}><Field label="العملة" value={currency} onChangeText={setCurrency} placeholder="ILS" /></View></View>
            <Field label="ملاحظات" value={notes} onChangeText={setNotes} placeholder="ملاحظات الفاتورة" multiline />
            {!editingId ? <>
              <Text style={{ color: colors.foreground, fontWeight: '800', marginBottom: 9 }}>اختر طلباً لربط المنتجات</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
                {(orders.data || []).map((entry) => <Pressable key={entry.id} onPress={() => { setSelectedOrderId(entry.id); setItemIds([]); }} style={{ paddingHorizontal: 13, paddingVertical: 10, borderRadius: 13, borderWidth: 1, borderColor: selectedOrderId === entry.id ? colors.primary : colors.border, backgroundColor: selectedOrderId === entry.id ? colors.muted : colors.background }}><Text style={{ color: colors.foreground, fontWeight: '700' }}>{entry.orderNumber}</Text></Pressable>)}
              </ScrollView>
              {order.data?.items?.length ? <View style={{ gap: 8, marginBottom: 14 }}>{order.data.items.filter((item) => !item.purchaseId).map((item) => {
                const selected = itemIds.includes(item.id);
                return <Pressable key={item.id} onPress={() => setItemIds((all) => selected ? all.filter((id) => id !== item.id) : [...all, item.id])} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: selected ? colors.primary : colors.border }}><Feather name={selected ? 'check-square' : 'square'} size={18} color={selected ? colors.primary : colors.mutedForeground} /><Text style={{ color: colors.foreground, flex: 1, textAlign: 'right' }}>{item.name} × {item.quantity}</Text></Pressable>;
              })}</View> : null}
            </> : null}
            {message ? <Text style={{ color: colors.destructive, marginBottom: 12, textAlign: 'right' }}>{message}</Text> : null}
            <PrimaryButton title={create.isPending || update.isPending ? 'جارٍ الحفظ...' : 'حفظ الفاتورة'} onPress={save} disabled={create.isPending || update.isPending} icon="save" />
          </KeyboardAwareScrollViewCompat>
        </View>
      </Modal>
    </>
  );
}