import { useCreateCustomer, useDeleteCustomer, useListCustomers, useUpdateCustomer } from '@workspace/api-client-react';
import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Card, EmptyState, ErrorState, Field, Header, LoadingState, Money, PrimaryButton, Pill } from '@/components/elan-ui';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import { useQueryClient } from '@tanstack/react-query';

export default function CustomersScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const customers = useListCustomers();
  const create = useCreateCustomer();
  const update = useUpdateCustomer();
  const remove = useDeleteCustomer();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [deliveryRequired, setDeliveryRequired] = useState(false);
  const [message, setMessage] = useState('');

  const closeForm = () => {
    setOpen(false);
    setEditingId(null);
    setName('');
    setPhone('');
    setAddress('');
    setDeliveryRequired(false);
    setMessage('');
  };

  const openNew = () => {
    closeForm();
    setOpen(true);
  };

  const openEdit = (customer: (typeof items)[number]) => {
    setEditingId(customer.id);
    setName(customer.name);
    setPhone(customer.phone);
    setAddress(customer.address || '');
    setDeliveryRequired(customer.deliveryRequired);
    setMessage('');
    setOpen(true);
  };

  const save = () => {
    setMessage('');
    const mutation = editingId ? update : create;
    const variables = editingId
      ? { id: editingId, data: { name: name.trim(), phone: phone.trim(), address: address.trim() || null, deliveryRequired } }
      : { data: { name: name.trim(), phone: phone.trim(), address: address.trim() || undefined, deliveryRequired } };
    mutation.mutate(variables as never, {
      onSuccess: () => {
        queryClient.invalidateQueries();
        closeForm();
      },
      onError: () => setMessage('تعذر حفظ العميل. تحقق من البيانات والاتصال.'),
    });
  };

  const confirmDelete = (customer: (typeof items)[number]) => {
    Alert.alert('حذف العميل؟', `سيتم حذف ${customer.name} فقط إذا لم يكن مرتبطاً بطلبات أو سجلات مالية.`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: () => remove.mutate({ id: customer.id }, {
          onSuccess: () => queryClient.invalidateQueries(),
          onError: () => Alert.alert('تعذر الحذف', 'هذا العميل مرتبط بطلبات أو سجلات مالية، لذلك يجب تعديل بياناته بدلاً من حذفه.'),
        }),
      },
    ]);
  };

  if (customers.isLoading) return <View style={{ flex: 1, backgroundColor: colors.background }}><LoadingState /></View>;
  if (customers.isError) return <View style={{ flex: 1, backgroundColor: colors.background, padding: 18 }}><ErrorState onRetry={() => customers.refetch()} /></View>;
  const items = customers.data || [];
  return (
    <>
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 18, paddingBottom: 110 }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={customers.isFetching} onRefresh={() => customers.refetch()} tintColor={colors.primary} />}>
        <Header title="العملاء" subtitle="بيانات التواصل والفواتير في مكان واحد" action={<Pressable onPress={openNew} style={({ pressed }) => ({ backgroundColor: colors.primary, width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.75 : 1 })}><Feather name="plus" size={21} color={colors.primaryForeground} /></Pressable>} />
        {items.length ? items.map((customer) => (
          <Card key={customer.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: '800' }}>{customer.name}</Text>
                <Text style={{ color: colors.mutedForeground, marginTop: 5 }}>{customer.phone}</Text>
                {customer.address ? <Text style={{ color: colors.mutedForeground, marginTop: 3 }}>{customer.address}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Pill tone={customer.remaining > 0 ? 'warning' : 'success'}>{customer.remaining > 0 ? 'عليه رصيد' : 'مسدد'}</Pill>
                <Text style={{ color: colors.foreground, fontWeight: '800', marginTop: 10 }}><Money value={customer.remaining} /></Text>
              </View>
            </View>
            {customer.deliveryRequired ? <View style={{ flexDirection: 'row', gap: 6, marginTop: 12, alignItems: 'center' }}><Feather name="truck" size={14} color={colors.accent} /><Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>يحتاج ديلفري</Text></View> : null}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <Pressable onPress={() => openEdit(customer)} style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 10, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="edit-2" size={15} color={colors.primary} /><Text style={{ color: colors.foreground, fontWeight: '700' }}>تعديل</Text>
              </Pressable>
              <Pressable onPress={() => confirmDelete(customer)} disabled={remove.isPending} style={{ flex: 1, borderWidth: 1, borderColor: colors.destructive, borderRadius: 12, paddingVertical: 10, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', opacity: remove.isPending ? 0.5 : 1 }}>
                <Feather name="trash-2" size={15} color={colors.destructive} /><Text style={{ color: colors.destructive, fontWeight: '700' }}>حذف</Text>
              </Pressable>
            </View>
          </Card>
        )) : <EmptyState title="لا يوجد عملاء بعد" description="أضف أول عميل لتبدأ ربط الطلبات والمدفوعات." icon="users" />}
      </ScrollView>
      <Modal visible={open} animationType="slide" transparent onRequestClose={closeForm}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
          <KeyboardAwareScrollViewCompat contentContainerStyle={{ padding: 20, paddingBottom: 35, backgroundColor: colors.card, borderTopLeftRadius: 26, borderTopRightRadius: 26 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: colors.foreground, fontSize: 21, fontWeight: '800' }}>{editingId ? 'تعديل العميل' : 'عميل جديد'}</Text>
              <Pressable onPress={closeForm}><Feather name="x" size={23} color={colors.mutedForeground} /></Pressable>
            </View>
            <Field label="الاسم الكامل" value={name} onChangeText={setName} placeholder="مثال: نور حداد" />
            <Field label="رقم الهاتف" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="05x xxx xxxx" />
            <Field label="العنوان" value={address} onChangeText={setAddress} placeholder="المدينة، الحي..." />
            <Pressable onPress={() => setDeliveryRequired((value) => !value)} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 18 }}>
              <Feather name={deliveryRequired ? 'check-square' : 'square'} size={20} color={deliveryRequired ? colors.primary : colors.mutedForeground} />
              <Text style={{ color: colors.foreground }}>يحتاج إلى ديلفري</Text>
            </Pressable>
            {message ? <Text style={{ color: colors.destructive, marginBottom: 12 }}>{message}</Text> : null}
            <PrimaryButton title={create.isPending || update.isPending ? 'جارٍ الحفظ...' : editingId ? 'حفظ التعديلات' : 'حفظ العميل'} onPress={save} disabled={!name.trim() || !phone.trim() || create.isPending || update.isPending} icon="save" />
          </KeyboardAwareScrollViewCompat>
        </View>
      </Modal>
    </>
  );
}