import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Card, Header } from '@/components/elan-ui';
import { useColors } from '@/hooks/useColors';

const links = [
  { title: 'مشتريات SHEIN', subtitle: 'الفواتير وربط المنتجات والإلغاء الآمن', icon: 'shopping-bag', route: '/purchases' },
  { title: 'الشحنات', subtitle: 'التتبع والوصول وتكاليف الشحن', icon: 'truck', route: '/shipments' },
  { title: 'التقارير', subtitle: 'الربح والمصروفات والأرصدة التشغيلية', icon: 'bar-chart-2', route: '/reports' },
  { title: 'الإعدادات', subtitle: 'بيانات النشاط والعملة والقيم الافتراضية', icon: 'settings', route: '/settings' },
] as const;

export default function MoreScreen() {
  const colors = useColors();
  const router = useRouter();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 18, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
      <Header title="إدارة العمل" subtitle="كل أدوات التشغيل المتقدمة من الهاتف" />
      {links.map((item) => (
        <Pressable key={item.route} onPress={() => router.push(item.route as never)} style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name={item.icon} size={21} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: '800', textAlign: 'right' }}>{item.title}</Text>
                <Text style={{ color: colors.mutedForeground, marginTop: 4, lineHeight: 20, textAlign: 'right' }}>{item.subtitle}</Text>
              </View>
              <Feather name="chevron-left" size={20} color={colors.mutedForeground} />
            </View>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}