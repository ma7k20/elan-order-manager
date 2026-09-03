import { asc, desc, eq } from "drizzle-orm";
import { conversations, db, messages, supportTicketsTable } from "@workspace/db";
import { customerContext } from "./business-data";
import { getAiSettings } from "./settings";

const buckets = new Map<string, number[]>();
const handoffWords = /موظف|بشري|مسؤول|شكوى|شكوى|إلغاء|محامي|مشكلة كبيرة/i;
const compact = (value: string) => value.trim().slice(0, 1200);

function allowed(key: string, max: number) {
  const now = Date.now();
  const items = (buckets.get(key) ?? []).filter((time) => now - time < 60_000);
  if (items.length >= max) return false;
  items.push(now); buckets.set(key, items); return true;
}

export async function createConversation(input: { title: string; phoneNumber?: string; customerId?: number }) {
  const [conversation] = await db.insert(conversations).values({ ...input, lastMessageAt: new Date() }).returning();
  return conversation;
}

export async function replyToConversation(conversationId: number, content: string, messageId?: string) {
  const [conversation] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  if (!conversation) throw new Error("Conversation not found");
  const settings = await getAiSettings();
  if (!allowed(conversation.phoneNumber ?? `conversation:${conversation.id}`, settings.rateLimitPerMinute)) throw new Error("RATE_LIMITED");
  const text = compact(content);
  const handoff = handoffWords.test(text) || conversation.handoffStatus === "human_requested";
  const [incoming] = await db.insert(messages).values({ conversationId, role: "user", sender: "customer", content: text, messageId, handoffStatus: handoff ? "requested" : null }).returning();
  let response = settings.humanHandoffMessage;
  if (settings.enabled && !handoff) {
    const prior = await db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(desc(messages.createdAt)).limit(settings.maxHistory);
    const context = await customerContext(conversation.phoneNumber, text);
    try {
      const { ai } = await import("@workspace/integrations-gemini-ai");
      const result = await ai.models.generateContent({
        model: settings.model,
        contents: prior.reverse().map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        config: { systemInstruction: `${settings.systemPrompt || ""}\n\nبيانات موثوقة خاصة بهذا المرسل فقط:\n${context}`, temperature: settings.temperature },
      });
      response = compact(result.text || "سامحينا، ما قدرت أجيب جواب هلا. بنرجعلك قريب.");
    } catch (error) {
      response = "سامحينا، صار عطل بسيط. رح يتابع معك المسؤول قريب.";
    }
  }
  await db.update(messages).set({ aiResponse: response, status: "answered", handoffStatus: handoff ? "requested" : null }).where(eq(messages.id, incoming.id));
  await db.insert(messages).values({ conversationId, role: "assistant", sender: "ai", content: response, status: "sent", handoffStatus: handoff ? "requested" : null });
  await db.update(conversations).set({ handoffStatus: handoff ? "human_requested" : conversation.handoffStatus, lastMessageAt: new Date() }).where(eq(conversations.id, conversationId));
  if (handoff) await db.insert(supportTicketsTable).values({ conversationId, customerId: conversation.customerId, phoneNumber: conversation.phoneNumber, subject: "طلب متابعة بشرية" });
  return { content: response, handoff };
}

export async function conversationMessages(id: number) {
  return db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt));
}