import { Feather } from '@expo/vector-icons';
import { useCancelShipment, useCreateShipment, useListPurchases, useListShipments, useUpdateShipment } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Card, EmptyState, ErrorState, Field, Header, LoadingState, Money, Pill, PrimaryButton, formatDate } from '@/components/elan-ui';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';

const today = () => new Date().toISOString().slice(0, 10);
const statusLabels: Record<string, string> = { preparing: 'قيد التجهيز', in_transit: 'في الطريق', arrived: 'وصلت', completed: 'مكتملة', cancelled: 'ملغاة' };

export default function ShipmentsScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const shipments = useListShipments();
  const purchases = useListPurchases();
  const create = useCreateShipment();
  const update = useUpdateShipment();
  const cancel = useCancelShipment();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [shipmentNumber, setShipmentNumber] = useState('');
  const [company, setCompany] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shipmentDate, setShipmentDate] = useState(today());
  const [arrivalDate, setArrivalDate] = useState('');
  const [shippingCost, setShippingCost] = useState('');
  const [currency, setCurrency] = useState('ILS');
  const [status, setStatus] = useState('preparing');
  const [purchaseIds, setPurchaseIds] = useState<number[]>([]);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const items = shipments.data || [];

  const close = () => {
    setOpen(false); setEditingId(null); setShipmentNumber(''); setCompany(''); setTrackingNumber(''); setShipmentDate(today()); setArrivalDate(''); setShippingCost(''); setCurrency('ILS'); setStatus('preparing'); setPurchaseIds([]); setNotes(''); setMessage('');
  };
  const openEdit = (shipment: (typeof items)[number]) => {
    setEditingId(shipment.id); setShipmentNumber(shipment.shipmentNumber); setCompany(shipment.company); setTrackingNumber(shipment.trackingNumber || ''); setShipmentDate(shipment.shipmentDate); setArrivalDate(shipment.arrivalDate || ''); setShippingCost(String(shipment.shippingCost)); setCurrency(shipment.currency); setStatus(shipment.status); setPurchaseIds(shipment.purchaseIds); setNotes(shipment.notes || ''); setMessage(''); setOpen(true);
  };
  const save = () => {
    const cost = Number(shippingCost || 0);
    if (!shipmentNumber.trim() || !company.trim() || !shipmentDate || !Number.isFinite(cost) || cost < 0) { setMessage('أدخل رقم الشحنة والشركة والتاريخ والتكلفة بصورة صحيحة.'); return; }
    const data = { shipmentNumber: shipmentNumber.trim(), company: company.trim(), trackingNumber: trackingNumber.trim() || null, shipmentDate, arrivalDate: arrivalDate || null, shippingCost: cost, currency, status, purchaseIds, notes: notes.trim() || null };
    const options = { onSuccess: () => { queryClient.invalidateQueries(); close(); }, onError: () => setMessage('تعذر حفظ الشحنة. تحقق من البيانات والاتصال.') };
    if (editingId) update.mutate({ id: editingId, data }, options);
    else create.mutate({ data: { ...data, trackingNumber: data.trackingNumber || undefined, notes: data.notes || undefined } }, options);
  };
  const confirmCancel = (id: number, label: string) => Alert.alert('إلغاء الشحنة؟', `سيبقى سجل ${label} محفوظاً، وستُعكس تكلفة الشحن في المحفظة.`, [
    { text: 'تراجع', style: 'cancel' },
    { text: 'إلغاء الشحنة', style: 'destructive', onPress: () => cancel.mutate({ id, data: { reason: 'إلغاء معتمد من تطبيق الهاتف' } }, { onSuccess: () => queryClient.invalidateQueries(), onError: () => Alert.alert('تعذر الإلغاء', 'الشحنة ملغاة بالفعل أو تعذر الوصول إلى الخادم.') }) },
  ]);

  if (shipments.isLoading || purchases.isLoading) return <View style={{ flex: 1, backgroundColor: colors.background }}><LoadingState /></View>;
  if (shipments.isError || purchases.isError) return <View style={{ flex: 1, backgroundColor: colors.background, padding: 18 }}><ErrorState onRetry={() => { shipments.refetch(); purchases.refetch(); }} /></View>;
  return (
    <>
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 18, paddingBottom: 110 }} refreshControl={<RefreshControl refreshing={shipments.isFetching} onRefresh={() => shipments.refetch()} tintColor={colors.primary} />}>
        <Header title="الشحنات" subtitle="التتبع والتكاليف وحالة الوصول" action={<Pressable onPress={() => { close(); setOpen(true); }} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}><Feather name="plus" size={21} color={colors.primaryForeground} /></Pressable>} />
        <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 14 }}><Feather name="arrow-right" size={17} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: '700' }}>العودة لإدارة العمل</Text></Pressable>
        {items.length ? items.map((shipment) => (
          <Card key={shipment.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}><Text style={{ color: colors.foreground, fontSize: 17, fontWeight: '800', textAlign: 'right' }}>{shipment.shipmentNumber}</Text><Text style={{ color: colors.mutedForeground, marginTop: 5, textAlign: 'right' }}>{shipment.company} · {formatDate(shipment.shipmentDate)}</Text></View>
              <Pill tone={shipment.status === 'cancelled' ? 'danger' : shipment.status === 'arrived' || shipment.status === 'completed' ? 'success' : 'warning'}>{statusLabels[shipment.status] || shipment.status}</Pill>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}><Text style={{ color: colors.mutedForeground }}>{shipment.purchaseIds.length} فاتورة</Text><Text style={{ color: colors.primary, fontWeight: '800' }}><Money value={shipment.shippingCost} currency={shipment.currency} /></Text></View>
            {shipment.trackingNumber ? <Text style={{ color: colors.foreground, marginTop: 10, textAlign: 'right' }}>تتبع: {shipment.trackingNumber}</Text> : null}
            {shipment.status !== 'cancelled' ? <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}><PrimaryButton title="تعديل" onPress={() => openEdit(shipment)} variant="secondary" icon="edit-2" style={{ flex: 1 }} /><PrimaryButton title="إلغاء آمن" onPress={() => confirmCancel(shipment.id, shipment.shipmentNumber)} variant="danger" icon="x-circle" style={{ flex: 1 }} disabled={cancel.isPending} /></View> : null}
          </Card>
        )) : <EmptyState title="لا توجد شحنات" description="أنشئ شحنة واربط بها فواتير SHEIN." icon="truck" />}
      </ScrollView>
      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
          <KeyboardAwareScrollViewCompat contentContainerStyle={{ padding: 20, paddingBottom: 35, backgroundColor: colors.card, borderTopLeftRadius: 26, borderTopRightRadius: 26 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 }}><Text style={{ color: colors.foreground, fontSize: 21, fontWeight: '800' }}>{editingId ? 'تعديل الشحنة' : 'شحنة جديدة'}</Text><Pressable onPress={close}><Feather name="x" size={23} color={colors.mutedForeground} /></Pressable></View>
            <Field label="رقم الشحنة" value={shipmentNumber} onChangeText={setShipmentNumber} placeholder="ELAN-SH-001" />
            <Field label="شركة الشحن" value={company} onChangeText={setCompany} placeholder="اسم الشركة" />
            <Field label="رقم التتبع" value={trackingNumber} onChangeText={setTrackingNumber} placeholder="اختياري" />
            <View style={{ flexDirection: 'row', gap: 9 }}><View style={{ flex: 1 }}><Field label="تاريخ الشحن" value={shipmentDate} onChangeText={setShipmentDate} placeholder="YYYY-MM-DD" /></View><View style={{ flex: 1 }}><Field label="تاريخ الوصول" value={arrivalDate} onChangeText={setArrivalDate} placeholder="YYYY-MM-DD" /></View></View>
            <View style={{ flexDirection: 'row', gap: 9 }}><View style={{ flex: 2 }}><Field label="تكلفة الشحن" value={shippingCost} onChangeText={setShippingCost} keyboardType="decimal-pad" /></View><View style={{ flex: 1 }}><Field label="العملة" value={currency} onChangeText={setCurrency} /></View></View>
            <Text style={{ color: colors.foreground, fontWeight: '800', marginBottom: 9 }}>حالة الشحنة</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 14 }}>{['preparing', 'in_transit', 'arrived', 'completed'].map((value) => <Pressable key={value} onPress={() => setStatus(value)} style={{ paddingHorizontal: 13, paddingVertical: 10, borderRadius: 13, borderWidth: 1, borderColor: status === value ? colors.primary : colors.border, backgroundColor: status === value ? colors.muted : colors.background }}><Text style={{ color: colors.foreground, fontWeight: '700' }}>{statusLabels[value]}</Text></Pressable>)}</ScrollView>
            <Text style={{ color: colors.foreground, fontWeight: '800', marginBottom: 9 }}>فواتير الشحنة</Text>
            <View style={{ gap: 8, marginBottom: 14 }}>{(purchases.data || []).filter((purchase) => purchase.status !== 'cancelled').map((purchase) => {
              const selected = purchaseIds.includes(purchase.id);
              return <Pressable key={purchase.id} onPress={() => setPurchaseIds((all) => selected ? all.filter((id) => id !== purchase.id) : [...all, purchase.id])} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: selected ? colors.primary : colors.border }}><Feather name={selected ? 'check-square' : 'square'} size={18} color={selected ? colors.primary : colors.mutedForeground} /><Text style={{ color: colors.foreground, flex: 1, textAlign: 'right' }}>{purchase.invoiceNumber} · <Money value={purchase.totalAmount} currency={purchase.currency} /></Text></Pressable>;
            })}</View>
            <Field label="ملاحظات" value={notes} onChangeText={setNotes} multiline placeholder="تفاصيل إضافية" />
            {message ? <Text style={{ color: colors.destructive, marginBottom: 12, textAlign: 'right' }}>{message}</Text> : null}
            <PrimaryButton title={create.isPending || update.isPending ? 'جارٍ الحفظ...' : 'حفظ الشحنة'} onPress={save} disabled={create.isPending || update.isPending} icon="save" />
          </KeyboardAwareScrollViewCompat>
        </View>
      </Modal>
    </>
  );
}