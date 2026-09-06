import { useGetOrder, useListOrders, useUpdateOrderItem } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { getGetOrderQueryKey } from '@workspace/api-client-react';
import { Card, EmptyState, ErrorState, Field, Header, LoadingState, Money, PrimaryButton } from '@/components/elan-ui';
import { useColors } from '@/hooks/useColors';

const productLabels: Record<string, string> = { requested: 'تم الطلب', in_shipping: 'في الشحن', arrived: 'وصلت', arrived_waiting: 'بانتظار الفرز', not_arrived: 'لم تصل' };
const deliveryLabels: Record<string, string> = { not_ready: 'لم تجهز', ready: 'جاهزة للتسليم', delivered: 'تم التسليم' };

export default function SortingScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const orders = useListOrders(search.trim() ? { search: search.trim() } : undefined);
  const order = useGetOrder(selectedId || 0, { query: { queryKey: getGetOrderQueryKey(selectedId || 0), enabled: Boolean(selectedId) } });
  const updateItem = useUpdateOrderItem();
  const visibleItems = useMemo(() => order.data?.items || [], [order.data?.items]);

  useEffect(() => {
    if (!selectedId && orders.data?.[0]) setSelectedId(orders.data[0].id);
  }, [orders.data, selectedId]);

  const save = (itemId: number, productStatus: string, deliveryStatus: string) => {
    if (!selectedId) return;
    updateItem.mutate({ id: selectedId, itemId, data: { productStatus, deliveryStatus } }, {
      onSuccess: () => { queryClient.invalidateQueries(); order.refetch(); },
      onError: () => undefined,
    });
  };

  if (orders.isLoading) return <View style={{ flex: 1, backgroundColor: colors.background }}><LoadingState /></View>;
  if (orders.isError) return <View style={{ flex: 1, backgroundColor: colors.background, padding: 18 }}><ErrorState onRetry={() => orders.refetch()} /></View>;

  return <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 18, paddingTop: 30, paddingBottom: 120 }} refreshControl={<RefreshControl refreshing={orders.isFetching} onRefresh={() => orders.refetch()} tintColor={colors.primary} />}>
    <Header title="الفرز والتسليم" subtitle="ابحث عن القطعة وشاهد صورتها وحدّث حالتها" />
    <Field label="بحث عن الطلب أو القطعة أو العميل" value={search} onChangeText={setSearch} placeholder="مثال: فستان أو ORD-123" />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 14 }}>
      {(orders.data || []).map((item) => <Pressable key={item.id} onPress={() => setSelectedId(item.id)} style={{ minWidth: 150, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: selectedId === item.id ? colors.primary : colors.border, backgroundColor: selectedId === item.id ? colors.secondary : colors.card }}><Text style={{ color: colors.foreground, fontWeight: '800', textAlign: 'right' }}>{item.orderNumber}</Text><Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 5, textAlign: 'right' }}>{item.customerName} · {item.itemCount} قطع</Text></Pressable>)}
    </ScrollView>
    {order.isLoading ? <LoadingState /> : order.data ? <Card><Text style={{ color: colors.foreground, fontSize: 18, fontWeight: '800', textAlign: 'right' }}>{order.data.orderNumber} · {order.data.customerName}</Text><View style={{ gap: 12, marginTop: 16 }}>{visibleItems.map((item) => <View key={item.id} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12 }}><View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>{item.imagePath ? <Image source={{ uri: item.imagePath }} style={{ width: 82, height: 82, borderRadius: 12 }} resizeMode="cover" /> : <View style={{ width: 82, height: 82, borderRadius: 12, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' }}><Feather name="image" size={22} color={colors.primary} /></View>}<View style={{ flex: 1 }}><Text style={{ color: colors.foreground, fontWeight: '800', textAlign: 'right' }}>{item.name}</Text><Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4, textAlign: 'right' }}>كمية {item.quantity} · <Money value={item.totalSelling} /></Text>{item.productUrl ? <Pressable onPress={() => Linking.openURL(item.productUrl!)}><Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700', marginTop: 7, textAlign: 'right' }}>فتح رابط القطعة</Text></Pressable> : null}</View></View><View style={{ gap: 8, marginTop: 10 }}><PrimaryButton title={productLabels[item.productStatus] || 'حالة المنتج'} onPress={() => { const values = ['requested', 'in_shipping', 'arrived', 'arrived_waiting']; const next = values[(values.indexOf(item.productStatus) + 1) % values.length]; save(item.id, next, item.deliveryStatus); }} variant="secondary" icon="package" /><PrimaryButton title={deliveryLabels[item.deliveryStatus] || 'حالة التسليم'} onPress={() => { const values = ['not_ready', 'ready', 'delivered']; const next = values[(values.indexOf(item.deliveryStatus) + 1) % values.length]; save(item.id, item.productStatus, next); }} variant={item.deliveryStatus === 'delivered' ? 'secondary' : 'primary'} icon="check-circle" /></View></View>)}</View></Card> : <EmptyState title="اختر طلبًا" description="اختر طلبًا من القائمة لعرض القطع والصور وفرزها." icon="package" />}
  </ScrollView>;
}
