import { useCreateOrder, useDeleteOrder, useListCustomers, useListOrders, useUpdateOrder } from '@workspace/api-client-react';
import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Image, Linking, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Card, EmptyState, ErrorState, Field, Header, LoadingState, Money, Pill, PrimaryButton } from '@/components/elan-ui';
import { useColors } from '@/hooks/useColors';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useQueryClient } from '@tanstack/react-query';

type ItemDraft = { name: string; quantity: string; sellingPrice: string; commission: string; sheinCost: string; productUrl: string; imagePath: string };

export default function OrdersScreen() {
  const colors = useColors();
  const orders = useListOrders();
  const customers = useListCustomers();
  const create = useCreateOrder();
  const update = useUpdateOrder();
  const remove = useDeleteOrder();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [itemsDraft, setItemsDraft] = useState<ItemDraft[]>([{ name: '', quantity: '1', sellingPrice: '', commission: '', sheinCost: '', productUrl: '', imagePath: '' }]);
  const [message, setMessage] = useState('');

  const updateItem = (index: number, key: keyof ItemDraft, value: string) => setItemsDraft((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  const cancelOrder = (orderId: number) => {
    Alert.alert('إلغاء الطلب؟', 'سيبقى الطلب وسجله المالي محفوظين، لكن ستتحول حالته إلى ملغي.', [
      { text: 'تراجع', style: 'cancel' },
      { text: 'إلغاء الطلب', style: 'destructive', onPress: () => update.mutate({ id: orderId, data: { status: 'cancelled' } }, { onSuccess: () => queryClient.invalidateQueries(), onError: () => Alert.alert('تعذر التعديل', 'لم نتمكن من إلغاء الطلب الآن.') }) },
    ]);
  };
  const deleteOrder = (orderId: number) => {
    Alert.alert('حذف الطلب التجريبي؟', 'الحذف مسموح فقط إذا لم توجد دفعات أو مشتريات أو حركات محفظة مرتبطة بالطلب.', [
      { text: 'تراجع', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: () => remove.mutate({ id: orderId }, { onSuccess: () => queryClient.invalidateQueries(), onError: () => Alert.alert('تعذر الحذف', 'الطلب مرتبط بسجلات مالية أو مشتريات؛ استخدم إلغاء الطلب بدلاً من الحذف.') }) },
    ]);
  };
  const save = () => {
    const valid = customerId && itemsDraft.every((item) => item.name.trim() && Number(item.sellingPrice) >= 0 && Number(item.sheinCost) >= 0);
    if (!valid) { setMessage('اختر العميل وأكمل اسم المنتج والسعر وتكلفة SHEIN.'); return; }
    setMessage('');
    create.mutate({
      data: {
        customerId,
        orderDate: new Date().toISOString().slice(0, 10),
        deliveryMethod,
        deliveryFee: deliveryMethod === 'delivery' ? Number(deliveryFee || 0) : 0,
        deliveryAddress: deliveryMethod === 'delivery' ? deliveryAddress.trim() || null : null,
        items: itemsDraft.map((item) => ({ name: item.name.trim(), quantity: Math.max(1, Number(item.quantity) || 1), sellingPrice: Number(item.sellingPrice), commission: Number(item.commission || 0), sheinCost: Number(item.sheinCost), productUrl: item.productUrl.trim() || null, imagePath: item.imagePath.trim() || null })),
      },
    }, {
      onSuccess: () => { queryClient.invalidateQueries(); setOpen(false); setCustomerId(null); setItemsDraft([{ name: '', quantity: '1', sellingPrice: '', commission: '', sheinCost: '', productUrl: '', imagePath: '' }]); setDeliveryFee(''); setDeliveryAddress(''); },
      onError: () => setMessage('تعذر حفظ الطلب. تحقق من البيانات والاتصال.'),
    });
  };
  if (orders.isLoading) return <View style={{ flex: 1, backgroundColor: colors.background }}><LoadingState /></View>;
  if (orders.isError) return <View style={{ flex: 1, backgroundColor: colors.background, padding: 18 }}><ErrorState onRetry={() => orders.refetch()} /></View>;
  const items = orders.data || [];
  return (
    <>
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 30, paddingBottom: 110 }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={orders.isFetching} onRefresh={() => orders.refetch()} tintColor={colors.primary} />}>
      <Header title="الطلبات" subtitle={`${items.length} طلب محفوظ في المساحة المشتركة`} action={<Pressable onPress={() => setOpen(true)} style={({ pressed }) => ({ backgroundColor: colors.primary, width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.75 : 1 })}><Feather name="plus" size={21} color={colors.primaryForeground} /></Pressable>} />
      {items.length ? items.map((order) => (
        <Card key={order.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: '800' }}>{order.customerName}</Text>
              <Text style={{ color: colors.mutedForeground, marginTop: 5 }}>{order.orderNumber} · {order.customerPhone}</Text>
              <View style={{ flexDirection: 'row', gap: 7, marginTop: 12, flexWrap: 'wrap' }}>
                <Pill>{order.deliveryMethod === 'delivery' ? 'ديلفري' : 'تسليم شخصي'}</Pill>
                <Pill tone={order.arrivedCount === order.itemCount ? 'success' : 'warning'}>{`${order.arrivedCount}/${order.itemCount} وصل`}</Pill>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: colors.foreground, fontWeight: '800' }}><Money value={order.totalSelling + order.deliveryFee} /></Text>
              <Text style={{ color: order.remaining > 0 ? colors.warning : colors.success, fontWeight: '800', marginTop: 8 }}><Money value={order.remaining} /></Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 3 }}>{order.remaining > 0 ? 'المتبقي' : 'مدفوع بالكامل'}</Text>
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 14 }} />
          <View style={{ gap: 10 }}>
            {(order.items || []).map((item) => <View key={item.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              {item.imagePath ? <Image source={{ uri: item.imagePath }} style={{ width: 52, height: 52, borderRadius: 10 }} resizeMode="cover" /> : <View style={{ width: 52, height: 52, borderRadius: 10, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' }}><Feather name="image" size={18} color={colors.primary} /></View>}
              <View style={{ flex: 1 }}><Text style={{ color: colors.foreground, fontWeight: '800', textAlign: 'right' }}>{item.name}</Text><Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 3, textAlign: 'right' }}>كمية {item.quantity} · {item.productStatus === 'arrived' ? 'وصلت' : item.productStatus === 'delivered' ? 'تم التسليم' : 'قيد الفرز'}</Text></View>
              {item.productUrl ? <Pressable onPress={() => Linking.openURL(item.productUrl!)}><Feather name="external-link" size={18} color={colors.primary} /></Pressable> : null}
            </View>)}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.mutedForeground }}>حالة الطلب</Text>
            <Text style={{ color: colors.foreground, fontWeight: '700' }}>{order.status === 'active' ? 'نشط' : order.status}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            {order.status !== 'cancelled' ? <Pressable onPress={() => cancelOrder(order.id)} disabled={update.isPending} style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 10, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', opacity: update.isPending ? 0.5 : 1 }}>
              <Feather name="x-circle" size={15} color={colors.warning} /><Text style={{ color: colors.foreground, fontWeight: '700' }}>إلغاء</Text>
            </Pressable> : null}
            <Pressable onPress={() => deleteOrder(order.id)} disabled={remove.isPending} style={{ flex: 1, borderWidth: 1, borderColor: colors.destructive, borderRadius: 12, paddingVertical: 10, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', opacity: remove.isPending ? 0.5 : 1 }}>
              <Feather name="trash-2" size={15} color={colors.destructive} /><Text style={{ color: colors.destructive, fontWeight: '700' }}>حذف تجريبي</Text>
            </Pressable>
          </View>
        </Card>
      )) : <EmptyState title="لا توجد طلبات" description="ستظهر الطلبات هنا فور إضافتها من الموقع أو التطبيق." icon="package" />}
    </ScrollView>
    <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
        <KeyboardAwareScrollViewCompat contentContainerStyle={{ padding: 20, paddingBottom: 35, backgroundColor: colors.card, borderTopLeftRadius: 26, borderTopRightRadius: 26 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <Text style={{ color: colors.foreground, fontSize: 21, fontWeight: '800' }}>طلب جديد</Text>
            <Pressable onPress={() => setOpen(false)}><Feather name="x" size={23} color={colors.mutedForeground} /></Pressable>
          </View>
          <Text style={{ color: colors.foreground, fontWeight: '700', marginBottom: 9 }}>اختر العميل</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 14 }}>
            {(customers.data || []).map((customer) => <Pressable key={customer.id} onPress={() => setCustomerId(customer.id)} style={{ paddingHorizontal: 13, paddingVertical: 10, borderRadius: 13, borderWidth: 1, borderColor: customerId === customer.id ? colors.primary : colors.border, backgroundColor: customerId === customer.id ? colors.secondary : colors.background }}><Text style={{ color: colors.foreground, fontWeight: '700' }}>{customer.name}</Text></Pressable>)}
          </ScrollView>
          <Text style={{ color: colors.foreground, fontWeight: '700', marginBottom: 9 }}>طريقة التسليم</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            {([['pickup', 'تسليم شخصي'], ['delivery', 'Delivery'] ] as const).map(([value, label]) => <Pressable key={value} onPress={() => setDeliveryMethod(value)} style={{ flex: 1, paddingVertical: 12, borderRadius: 13, borderWidth: 1, borderColor: deliveryMethod === value ? colors.primary : colors.border, backgroundColor: deliveryMethod === value ? colors.secondary : colors.background, alignItems: 'center' }}><Text style={{ color: colors.foreground, fontWeight: '800' }}>{label}</Text></Pressable>)}
          </View>
          {deliveryMethod === 'delivery' ? <><Field label="رسوم التوصيل (تضاف على الفاتورة)" value={deliveryFee} onChangeText={setDeliveryFee} keyboardType="decimal-pad" placeholder="10" /><Field label="عنوان التوصيل" value={deliveryAddress} onChangeText={setDeliveryAddress} placeholder="العنوان الكامل" /></> : null}
          {itemsDraft.map((item, index) => <Card key={index} style={{ backgroundColor: colors.background }}><Text style={{ color: colors.foreground, fontWeight: '800', marginBottom: 10 }}>{`المنتج ${index + 1}`}</Text><Field label="اسم المنتج" value={item.name} onChangeText={(value) => updateItem(index, 'name', value)} placeholder="مثال: فستان صيفي" /><View style={{ flexDirection: 'row', gap: 8 }}><View style={{ flex: 1 }}><Field label="الكمية" value={item.quantity} onChangeText={(value) => updateItem(index, 'quantity', value)} keyboardType="number-pad" /></View><View style={{ flex: 1 }}><Field label="سعر العميل" value={item.sellingPrice} onChangeText={(value) => updateItem(index, 'sellingPrice', value)} keyboardType="decimal-pad" /></View></View><View style={{ flexDirection: 'row', gap: 8 }}><View style={{ flex: 1 }}><Field label="العمولة لكل قطعة" value={item.commission} onChangeText={(value) => updateItem(index, 'commission', value)} keyboardType="decimal-pad" placeholder="5" /></View><View style={{ flex: 1 }}><Field label="تكلفة SHEIN" value={item.sheinCost} onChangeText={(value) => updateItem(index, 'sheinCost', value)} keyboardType="decimal-pad" /></View></View><Field label="رابط القطعة" value={item.productUrl} onChangeText={(value) => updateItem(index, 'productUrl', value)} keyboardType="url" placeholder="https://..." /><Field label="رابط الصورة" value={item.imagePath} onChangeText={(value) => updateItem(index, 'imagePath', value)} keyboardType="url" placeholder="https://..." />{item.imagePath ? <Image source={{ uri: item.imagePath }} style={{ width: '100%', height: 180, borderRadius: 14 }} resizeMode="cover" /> : null}{itemsDraft.length > 1 ? <PrimaryButton title="حذف المنتج" onPress={() => setItemsDraft((all) => all.filter((_, itemIndex) => itemIndex !== index))} variant="ghost" icon="trash-2" /> : null}</Card>)}
          <PrimaryButton title="إضافة منتج آخر" onPress={() => setItemsDraft((all) => [...all, { name: '', quantity: '1', sellingPrice: '', commission: '', sheinCost: '', productUrl: '', imagePath: '' }])} variant="secondary" icon="plus" />
          {message ? <Text style={{ color: colors.destructive, marginTop: 12, marginBottom: 12 }}>{message}</Text> : null}
          <View style={{ marginTop: 10 }}><PrimaryButton title={create.isPending ? 'جارٍ حفظ الطلب...' : 'حفظ الطلب'} onPress={save} disabled={create.isPending} icon="save" /></View>
        </KeyboardAwareScrollViewCompat>
      </View>
    </Modal>
    </>
  );
}