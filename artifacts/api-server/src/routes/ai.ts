import { Router, type IRouter } from "express";
import { count, desc, eq } from "drizzle-orm";
import {
  CreateGeminiConversationBody, CreateGeminiConversationResponse, DeleteGeminiConversationParams, GetAiSettingsResponse, GetAiStatusResponse,
  GetGeminiConversationParams, GetGeminiConversationResponse, ListGeminiConversationsResponse,
  ListGeminiMessagesParams, ListGeminiMessagesResponse, SendGeminiMessageBody, TestAiChatBody,
  TestAiChatResponse, UpdateAiSettingsBody, UpdateAiSettingsResponse,
} from "@workspace/api-zod";
import { aiSettingsTable, conversations, db, messages } from "@workspace/db";
import { createConversation, conversationMessages, replyToConversation } from "../services/ai/chat";
import { getAiSettings } from "../services/ai/settings";
import { requireAccountAdmin, requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();
router.use(requireAuth);
const invalid = (res: import("express").Response, message: string) => res.status(400).json({ error: message });

router.get("/gemini/conversations", async (_req, res) => {
  const rows = await db.select().from(conversations).orderBy(desc(conversations.lastMessageAt));
  res.json(ListGeminiConversationsResponse.parse(rows));
});
router.post("/gemini/conversations", async (req, res): Promise<void> => {
  const input = CreateGeminiConversationBody.safeParse(req.body);
  if (!input.success) { invalid(res, input.error.message); return; }
  res.status(201).json(CreateGeminiConversationResponse.parse(await createConversation(input.data)));
});
router.get("/gemini/conversations/:id", async (req, res): Promise<void> => {
  const params = GetGeminiConversationParams.safeParse(req.params);
  if (!params.success) { invalid(res, params.error.message); return; }
  const [conversation] = await db.select().from(conversations).where(eq(conversations.id, params.data.id)).limit(1);
  if (!conversation) { res.status(404).json({ error: "Conversation not found" }); return; }
  res.json(GetGeminiConversationResponse.parse({ ...conversation, messages: await conversationMessages(conversation.id) }));
});
router.delete("/gemini/conversations/:id", async (req, res): Promise<void> => {
  const params = DeleteGeminiConversationParams.safeParse(req.params);
  if (!params.success) { invalid(res, params.error.message); return; }
  const [deleted] = await db.delete(conversations).where(eq(conversations.id, params.data.id)).returning();
  if (!deleted) { res.status(404).json({ error: "Conversation not found" }); return; }
  res.sendStatus(204);
});
router.get("/gemini/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = ListGeminiMessagesParams.safeParse(req.params);
  if (!params.success) { invalid(res, params.error.message); return; }
  res.json(ListGeminiMessagesResponse.parse(await conversationMessages(params.data.id)));
});
router.post("/gemini/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = GetGeminiConversationParams.safeParse(req.params);
  const input = SendGeminiMessageBody.safeParse(req.body);
  if (!params.success || !input.success) { invalid(res, "Invalid message"); return; }
  try { res.json(await replyToConversation(params.data.id, input.data.content)); }
  catch (error) { res.status((error as Error).message === "RATE_LIMITED" ? 429 : 404).json({ error: (error as Error).message }); }
});
router.get("/ai/status", async (_req, res) => {
  const [[conversationCount], [messageCount], [handoffCount], latest] = await Promise.all([
    db.select({ value: count() }).from(conversations), db.select({ value: count() }).from(messages),
    db.select({ value: count() }).from(conversations).where(eq(conversations.handoffStatus, "human_requested")),
    db.select({ lastMessageAt: conversations.lastMessageAt }).from(conversations).orderBy(desc(conversations.lastMessageAt)).limit(1),
  ]);
  res.json(GetAiStatusResponse.parse({ geminiConnected: Boolean(process.env.AI_INTEGRATIONS_GEMINI_API_KEY), whatsappConnected: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID), webhookConfigured: Boolean(process.env.WHATSAPP_VERIFY_TOKEN), lastMessageAt: latest[0]?.lastMessageAt ?? null, conversationCount: Number(conversationCount.value), messageCount: Number(messageCount.value), handoffCount: Number(handoffCount.value) }));
});
router.get("/ai/settings", requireAccountAdmin, async (_req, res) => res.json(GetAiSettingsResponse.parse(await getAiSettings())));
router.patch("/ai/settings", requireAccountAdmin, async (req, res): Promise<void> => {
  const input = UpdateAiSettingsBody.safeParse(req.body);
  if (!input.success) { invalid(res, input.error.message); return; }
  const current = await getAiSettings();
  const [updated] = await db.update(aiSettingsTable).set({ ...input.data, updatedAt: new Date() }).where(eq(aiSettingsTable.id, current.id)).returning();
  res.json(UpdateAiSettingsResponse.parse(updated));
});
router.post("/ai/test-chat", async (req, res): Promise<void> => {
  const input = TestAiChatBody.safeParse(req.body);
  if (!input.success) { invalid(res, input.error.message); return; }
  const conversation = input.data.conversationId
    ? await db.select().from(conversations).where(eq(conversations.id, input.data.conversationId)).limit(1).then((rows) => rows[0])
    : await createConversation({ title: "اختبار مسؤول" });
  if (!conversation) { res.status(404).json({ error: "Conversation not found" }); return; }
  try { res.json(TestAiChatResponse.parse({ conversationId: conversation.id, ...(await replyToConversation(conversation.id, input.data.content)) })); }
  catch (error) { res.status((error as Error).message === "RATE_LIMITED" ? 429 : 500).json({ error: (error as Error).message }); }
});
export default router;