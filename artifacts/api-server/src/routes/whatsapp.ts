```ts
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

  const expected = `sha256=${createHmac("sha256", appSecret)
  .update(rawBody)
  .digest("hex")}`;

const receivedBuffer = Buffer.from(signature);
const expectedBuffer = Buffer.from(expected);

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

  for (const change of changes) {
    const value = change?.value;

    for (const incoming of value?.messages ?? []) {
      if (
        incoming?.from === undefined ||
        incoming?.type !== "text" ||
        !incoming?.text?.body ||
        !incoming?.id
      ) {
        continue;
      }

      const duplicate = await db
        .select({ id: messages.id })
        .from(messages)
        .where(eq(messages.messageId, incoming.id))
        .limit(1);

      if (duplicate[0]) continue;

      const phone = String(incoming.from);

      let [conversation] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.phoneNumber, phone))
        .limit(1);

      if (!conversation) {
        conversation = await createConversation({
          title:
            value?.contacts?.[0]?.profile?.name ||
            `WhatsApp ${phone.slice(-4)}`,
          phoneNumber: phone,
        });
      }

      try {
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
            err: (error as Error).message,
          },
          "WhatsApp message processing failed",
        );
      }
    }
  }
});

export default router;
```
