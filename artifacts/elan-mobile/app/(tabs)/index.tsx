import { useGetDashboard, useGetSettings } from '@workspace/api-client-react';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { AppLogo, Card, ErrorState, Header, LoadingState, Money, Pill, SectionTitle, StatCard } from '@/components/elan-ui';
import { useColors } from '@/hooks/useColors';
import { useMobileAuth } from '@/lib/auth';

export default function DashboardScreen() {
  const colors = useColors();
  const router = useRouter();
  const { account, logout } = useMobileAuth();
  const dashboard = useGetDashboard();
  const settings = useGetSettings();
  const data = dashboard.data;

  if (dashboard.isLoading) return <View style={{ flex: 1, backgroundColor: colors.background }}><LoadingState /></View>;
  if (dashboard.isError || !data) return <View style={{ flex: 1, backgroundColor: colors.background, padding: 18 }}><ErrorState onRetry={() => dashboard.refetch()} /></View>;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 18, paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={dashboard.isFetching} onRefresh={() => dashboard.refetch()} tintColor={colors.primary} />}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 }}>
        <AppLogo />
        <Pressable onPress={() => logout()} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 8 })}>
          <Feather name="log-out" size={20} color={colors.mutedForeground} />
        </Pressable>
      </View>
      <Header title={`مرحباً ${account?.name || 'بكم'}`} subtitle={settings.data?.businessName ? `${settings.data.businessName} · نظرة سريعة على اليوم` : 'نظرة سريعة على اليوم'} />
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
        <StatCard label="رصيد المحفظة" value={<Money value={data.walletBalance} />} tone="primary" icon="credit-card" />
        <StatCard label="طلبات نشطة" value={String(data.activeOrders)} tone="gold" icon="package" />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <StatCard label="بانتظار الوصول" value={String(data.waitingProducts)} tone="accent" icon="clock" />
        <StatCard label="وصلت ولم تُسلّم" value={String(data.arrivedUndelivered)} tone="mint" icon="truck" />
      </View>
      <SectionTitle title="ملخص مالي" />
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
          <Text style={{ color: colors.mutedForeground }}>إجمالي الدخل</Text>
          <Text style={{ color: colors.success, fontWeight: '800' }}><Money value={data.totalIncome} /></Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
          <Text style={{ color: colors.mutedForeground }}>إجمالي المصروف</Text>
          <Text style={{ color: colors.destructive, fontWeight: '800' }}><Money value={data.totalExpenses} /></Text>
        </View>
        <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 14 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.foreground, fontWeight: '800' }}>الربح التقديري</Text>
          <Text style={{ color: colors.primary, fontWeight: '800' }}><Money value={data.estimatedProfit} /></Text>
        </View>
      </Card>
      <SectionTitle title="تنبيهات تحتاج متابعة" action={<Pill tone={data.alerts.length ? 'warning' : 'success'}>{data.alerts.length ? `${data.alerts.length} تنبيه` : 'كل شيء جيد'}</Pill>} />
      {data.alerts.length ? data.alerts.slice(0, 3).map((alert) => (
        <Card key={alert.id}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Feather name="alert-triangle" size={18} color={colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontWeight: '800' }}>{alert.title}</Text>
              <Text style={{ color: colors.mutedForeground, marginTop: 4 }}>{alert.description}</Text>
            </View>
          </View>
        </Card>
      )) : <Card><Text style={{ color: colors.mutedForeground, textAlign: 'center' }}>لا توجد منتجات ناقصة أو تنبيهات حالياً.</Text></Card>}
      <SectionTitle title="آخر الطلبات" action={<Pressable onPress={() => router.push('/(tabs)/orders')}><Text style={{ color: colors.primary, fontWeight: '800' }}>عرض الكل</Text></Pressable>} />
      {data.recentOrders.slice(0, 4).map((order) => (
        <Card key={order.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontWeight: '800' }}>{order.customerName}</Text>
              <Text style={{ color: colors.mutedForeground, marginTop: 4 }}>{order.orderNumber} · {order.itemCount} منتجات</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: colors.foreground, fontWeight: '800' }}><Money value={order.totalSelling + order.deliveryFee} /></Text>
              <Pill tone={order.remaining > 0 ? 'warning' : 'success'}>{order.remaining > 0 ? 'متبقي' : 'مدفوع'}</Pill>
            </View>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}
