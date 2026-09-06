import { Router, type IRouter } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  ReceiveWhatsAppWebhookBody,
  VerifyWhatsAppWebhookQueryParams,
} from "@workspace/api-zod";
import { conversations, db, messages } from "@workspace/db";
import {
  createConversation,
  replyToConversation,
} from "../services/ai/chat";
import { sendWhatsAppText } from "../services/whatsapp/client";

const router: IRouter = Router();

router.get("/whatsapp/webhook", (req, res): void => {
  const query = VerifyWhatsAppWebhookQueryParams.safeParse(req.query);

  if (
    query.success &&
    query.data["hub.mode"] === "subscribe" &&
    query.data["hub.verify_token"] &&
    query.data["hub.verify_token"] === process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    res.status(200).send(query.data["hub.challenge"] ?? "");
    return;
  }

  res.sendStatus(403);
});

router.post("/whatsapp/webhook", async (req, res): Promise<void> => {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const signature = req.header("x-hub-signature-256");
  const rawBody = (req as typeof req & { rawBody?: Buffer }).rawBody;

  req.log.info(
    {
      hasSignature: Boolean(signature),
      rawBodyLength: rawBody?.length ?? 0,
      contentType: req.headers["content-type"],
    },
    "WhatsApp webhook received",
  );

  if (!appSecret) {
    res.status(503).json({
      error: "WhatsApp webhook signature verification is not configured",
    });
    return;
  }

  if (!signature || !rawBody) {
    req.log.warn(
      {
        hasSignature: Boolean(signature),
        rawBodyLength: rawBody?.length ?? 0,
        contentType: req.headers["content-type"],
      },
      "WhatsApp webhook missing signature or raw body",
    );

    res.sendStatus(401);
    return;
  }

  const hash = createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");

  const expected = "sha256=" + hash;

  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    req.log.warn(
      {
        hasSignature: true,
        rawBodyLength: rawBody.length,
        signatureLength: signature.length,
        signaturePrefix: signature.slice(0, 7),
      },
      "WhatsApp webhook signature mismatch",
    );

    res.sendStatus(401);
    return;
  }

  const parsed = ReceiveWhatsAppWebhookBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid webhook body",
    });
    return;
  }

  res.sendStatus(200);

  const changes = (req.body?.entry ?? []).flatMap(
    (entry: any) => entry.changes ?? [],
  );
  const receivedMessages = changes.flatMap(
    (change: any) => change?.value?.messages ?? [],
  );

  req.log.info(
    {
      entryCount: Array.isArray(req.body?.entry) ? req.body.entry.length : 0,
      changeCount: changes.length,
      messageCount: receivedMessages.length,
      textMessageCount: receivedMessages.filter((message: any) => message?.type === "text").length,
    },
    "WhatsApp webhook payload accepted",
  );

  for (const change of changes) {
    const value = change?.value;

    for (const incoming of value?.messages ?? []) {
      if (
        incoming?.from === undefined ||
        incoming?.type !== "text" ||
        !incoming?.text?.body ||
        !incoming?.id
      ) {
        req.log.warn(
          {
            hasFrom: incoming?.from !== undefined,
            type: incoming?.type,
            hasTextBody: Boolean(incoming?.text?.body),
            hasMessageId: Boolean(incoming?.id),
          },
          "WhatsApp message skipped because required fields are missing",
        );
        continue;
      }

      const duplicate = await db
        .select({ id: messages.id })
        .from(messages)
        .where(eq(messages.messageId, incoming.id))
        .limit(1);

      if (duplicate[0]) {
        req.log.info("WhatsApp duplicate message skipped");
        continue;
      }

      const phone = String(incoming.from);

      let [conversation] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.phoneNumber, phone))
        .limit(1);

      if (!conversation) {
        const customerName =
          value?.contacts?.[0]?.profile?.name ||
          "WhatsApp customer";

        conversation = await createConversation({
          title: customerName,
          phoneNumber: phone,
        });
      }

      try {
        req.log.info("WhatsApp text message processing started");
        const answer = await replyToConversation(
          conversation.id,
          incoming.text.body,
          incoming.id,
        );

        await sendWhatsAppText(phone, answer.content);

        req.log.info(
          {
            conversationId: conversation.id,
            messageId: incoming.id,
          },
          "WhatsApp message processed",
        );
      } catch (error) {
        req.log.warn(
          {
            conversationId: conversation.id,
            messageId: incoming.id,
            err: error instanceof Error ? error.message : String(error),
          },
          "WhatsApp message processing failed",
        );
      }
    }
  }
});

export default router;
