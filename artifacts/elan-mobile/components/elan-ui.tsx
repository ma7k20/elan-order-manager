import { Feather } from '@expo/vector-icons';
import React, { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';

export function AppLogo({ compact = false }: { compact?: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.logoRow}>
      <View style={[styles.logoMark, { backgroundColor: colors.foreground }]}>
        <Image source={require('@/assets/images/icon.png')} style={styles.logoImage} resizeMode="cover" />
      </View>
      {!compact && (
        <View>
          <Text style={[styles.logoTitle, { color: colors.foreground }]}>ELAN</Text>
          <Text style={[styles.logoSub, { color: colors.mutedForeground }]}>إدارة الشراكة</Text>
        </View>
      )}
    </View>
  );
}

export function Screen({
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const colors = useColors();
  const content = (
    <View style={[styles.screenContent, { backgroundColor: colors.background }]}>
      {children}
    </View>
  );
  if (!scroll) return <View style={[styles.screen, { backgroundColor: colors.background }]}>{content}</View>;
  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? undefined : undefined}
      onScrollBeginDrag={() => undefined}
    >
      {content}
    </ScrollView>
  );
}

export function Header({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.header}>
      <View>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>مساحة الشريكين</Text>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{title}</Text>
        {subtitle ? <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  const colors = useColors();
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}>{children}</View>;
}

export function StatCard({
  label,
  value,
  tone = 'primary',
  icon,
}: {
  label: string;
  value: ReactNode;
  tone?: 'primary' | 'gold' | 'accent' | 'mint';
  icon: keyof typeof Feather.glyphMap;
}) {
  const colors = useColors();
  const palette = {
    primary: { backgroundColor: colors.primary, foreground: colors.primaryForeground },
    gold: { backgroundColor: colors.secondary, foreground: colors.secondaryForeground },
    accent: { backgroundColor: colors.accent, foreground: colors.accentForeground },
    mint: { backgroundColor: colors.muted, foreground: colors.foreground },
  }[tone];
  return (
    <View style={[styles.statCard, { backgroundColor: palette.backgroundColor }]}>
      <Feather name={icon} size={18} color={palette.foreground} />
      <Text style={[styles.statLabel, { color: palette.foreground }]}>{label}</Text>
      <Text style={[styles.statValue, { color: palette.foreground }]}>{value}</Text>
    </View>
  );
}

export function Pill({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'success' | 'warning' | 'danger' }) {
  const colors = useColors();
  const palette = {
    muted: { backgroundColor: colors.muted, color: colors.mutedForeground },
    success: { backgroundColor: colors.successSoft, color: colors.success },
    warning: { backgroundColor: colors.warningSoft, color: colors.warning },
    danger: { backgroundColor: colors.dangerSoft, color: colors.destructive },
  }[tone];
  return <Text style={[styles.pill, { backgroundColor: palette.backgroundColor, color: palette.color }]}>{children}</Text>;
}

export function Money({ value, currency = 'ILS' }: { value: number; currency?: string }) {
  const symbol = currency === 'ILS' ? '₪' : currency;
  return <Text>{`${Number(value || 0).toFixed(2)} ${symbol}`}</Text>;
}

export function PrimaryButton({
  title,
  onPress,
  disabled = false,
  variant = 'primary',
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: keyof typeof Feather.glyphMap;
  style?: object;
}) {
  const colors = useColors();
  const backgroundColor = variant === 'primary' ? colors.primary : variant === 'secondary' ? colors.secondary : variant === 'danger' ? colors.destructive : 'transparent';
  const textColor = variant === 'primary' || variant === 'danger' ? colors.primaryForeground : colors.foreground;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor, borderColor: colors.border, opacity: disabled ? 0.5 : pressed ? 0.78 : 1 },
        variant === 'ghost' && { borderWidth: 0 },
        style,
      ]}
    >
      {icon ? <Feather name={icon} size={17} color={textColor} /> : null}
      <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.mutedForeground}
        style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }, props.style]}
      />
    </View>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.sectionTitle}>
      <Text style={[styles.sectionText, { color: colors.foreground }]}>{title}</Text>
      {action}
    </View>
  );
}

export function EmptyState({ title, description, icon = 'inbox' }: { title: string; description: string; icon?: keyof typeof Feather.glyphMap }) {
  const colors = useColors();
  return (
    <Card style={styles.empty}>
      <Feather name={icon} size={30} color={colors.accent} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.emptyDescription, { color: colors.mutedForeground }]}>{description}</Text>
    </Card>
  );
}

export function LoadingState() {
  const colors = useColors();
  return <ActivityIndicator color={colors.primary} size="large" style={styles.loader} />;
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const colors = useColors();
  return (
    <Card style={styles.empty}>
      <Feather name="alert-circle" size={30} color={colors.destructive} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>تعذر تحميل البيانات</Text>
      <Text style={[styles.emptyDescription, { color: colors.mutedForeground }]}>تحقق من الاتصال أو صلاحية الحساب.</Text>
      <PrimaryButton title="إعادة المحاولة" onPress={onRetry} variant="secondary" icon="refresh-cw" />
    </Card>
  );
}

export function formatDate(value?: string | Date | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('ar', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const styles = StyleSheet.create({
  screen: { flex: 1 },
  screenContent: { flex: 1, paddingHorizontal: 18, paddingTop: 18 },
  scrollContent: { paddingBottom: 100 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoMark: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  logoImage: { width: 42, height: 42, borderRadius: 14 },
  logoLetter: { fontSize: 23, fontWeight: '800' },
  logoTitle: { fontSize: 19, fontWeight: '800', letterSpacing: 2 },
  logoSub: { fontSize: 10, marginTop: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  eyebrow: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  headerTitle: { fontSize: 29, fontWeight: '800' },
  headerSub: { fontSize: 13, marginTop: 4 },
  card: { borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 12 },
  statCard: { borderRadius: 18, padding: 15, minHeight: 118, justifyContent: 'space-between', flex: 1 },
  statLabel: { fontSize: 11, opacity: 0.75, marginTop: 12 },
  statValue: { fontSize: 19, fontWeight: '800', marginTop: 3 },
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '700', overflow: 'hidden' },
  button: { minHeight: 46, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  buttonText: { fontWeight: '800', fontSize: 14 },
  field: { marginBottom: 13 },
  fieldLabel: { fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, fontSize: 15, textAlign: 'right' },
  sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 10 },
  sectionText: { fontSize: 17, fontWeight: '800' },
  empty: { alignItems: 'center', paddingVertical: 30, gap: 9 },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptyDescription: { textAlign: 'center', lineHeight: 22, fontSize: 13, maxWidth: 290 },
  loader: { marginTop: 70 },
});