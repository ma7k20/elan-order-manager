import { Feather } from '@expo/vector-icons';
import { useGetReportSummary } from '@workspace/api-client-react';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Card, ErrorState, Header, LoadingState, Money, SectionTitle, StatCard, formatDate } from '@/components/elan-ui';
import { useColors } from '@/hooks/useColors';

const ranges = [{ value: 'today', label: 'اليوم' }, { value: 'week', label: 'أسبوع' }, { value: 'month', label: 'شهر' }] as const;

export default function ReportsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [range, setRange] = useState<'today' | 'week' | 'month'>('month');
  const report = useGetReportSummary({ range });
  if (report.isLoading) return <View style={{ flex: 1, backgroundColor: colors.background }}><LoadingState /></View>;
  if (report.isError || !report.data) return <View style={{ flex: 1, backgroundColor: colors.background, padding: 18 }}><ErrorState onRetry={() => report.refetch()} /></View>;
  const data = report.data;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 18, paddingBottom: 110 }} refreshControl={<RefreshControl refreshing={report.isFetching} onRefresh={() => report.refetch()} tintColor={colors.primary} />}>
      <Header title="التقارير" subtitle={`${formatDate(data.from)} — ${formatDate(data.to)}`} />
      <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 14 }}><Feather name="arrow-right" size={17} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: '700' }}>العودة لإدارة العمل</Text></Pressable>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>{ranges.map((item) => <Pressable key={item.value} onPress={() => setRange(item.value)} style={{ flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center', backgroundColor: range === item.value ? colors.primary : colors.card, borderWidth: 1, borderColor: range === item.value ? colors.primary : colors.border }}><Text style={{ color: range === item.value ? colors.primaryForeground : colors.foreground, fontWeight: '800' }}>{item.label}</Text></Pressable>)}</View>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}><StatCard label="الإيراد" value={<Money value={data.revenue} />} tone="primary" icon="trending-up" /><StatCard label="الربح" value={<Money value={data.profit} />} tone="gold" icon="bar-chart-2" /></View>
      <View style={{ flexDirection: 'row', gap: 10 }}><StatCard label="تكلفة المنتجات" value={<Money value={data.productCosts} />} tone="accent" icon="shopping-bag" /><StatCard label="رصيد المحفظة" value={<Money value={data.walletBalance} />} tone="mint" icon="credit-card" /></View>
      <SectionTitle title="تفاصيل مالية" />
      <Card>{[
        ['الدخل المؤكد', data.income, colors.success],
        ['المصروفات', data.expenses, colors.destructive],
        ['العمولات', data.commission, colors.primary],
        ['أرصدة العملاء', data.customerBalances, colors.warning],
      ].map(([label, value, color]) => <View key={String(label)} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9 }}><Text style={{ color: colors.mutedForeground }}>{label}</Text><Text style={{ color: String(color), fontWeight: '800' }}><Money value={Number(value)} /></Text></View>)}</Card>
      <SectionTitle title="مؤشرات تشغيلية" />
      <Card><View style={{ flexDirection: 'row', justifyContent: 'space-around' }}><View style={{ alignItems: 'center' }}><Text style={{ color: colors.primary, fontSize: 25, fontWeight: '800' }}>{data.missingProducts}</Text><Text style={{ color: colors.mutedForeground, marginTop: 5 }}>منتجات مفقودة</Text></View><View style={{ width: 1, backgroundColor: colors.border }} /><View style={{ alignItems: 'center' }}><Text style={{ color: colors.accent, fontSize: 25, fontWeight: '800' }}>{data.awaitingDelivery}</Text><Text style={{ color: colors.mutedForeground, marginTop: 5 }}>بانتظار التسليم</Text></View></View></Card>
      <SectionTitle title="مصادر الحركة" />
      {data.breakdown.map((item) => <Card key={item.label}><Text style={{ color: colors.foreground, fontWeight: '800', textAlign: 'right' }}>{item.label}</Text><View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}><Text style={{ color: colors.success }}>دخل <Money value={item.income} /></Text><Text style={{ color: colors.destructive }}>مصروف <Money value={item.expenses} /></Text></View></Card>)}
    </ScrollView>
  );
}