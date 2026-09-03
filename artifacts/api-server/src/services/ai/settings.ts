import { aiSettingsTable, db } from "@workspace/db";

export const DEFAULT_PROMPT = "أنت مساعد خدمة العملاء لمتجر ELAN في فلسطين. احكِ بالعربية الفلسطينية، بلطف وباختصار. استخدم فقط البيانات المرفقة لك، ولا تخمّن ولا تذكر بيانات أي زبون آخر. لطلبات التوصيل أو الدفع أو الطلبات، أكّد أن رقم الواتساب يطابق صاحب الطلب. إذا طلب الزبون موظفاً أو شكوى أو كان الموضوع حساساً، اطلب تحويله لمسؤول.";

export async function getAiSettings() {
  const rows = await db.select().from(aiSettingsTable).limit(1);
  if (rows[0]) return rows[0];
  const [created] = await db.insert(aiSettingsTable).values({ systemPrompt: DEFAULT_PROMPT }).returning();
  return created;
}