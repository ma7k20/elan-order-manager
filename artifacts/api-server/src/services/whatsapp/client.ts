const graphUrl = () =>
  "https://graph.facebook.com/" +
  (process.env.WHATSAPP_GRAPH_API_VERSION || "v21.0") +
  "/" +
  process.env.WHATSAPP_PHONE_NUMBER_ID +
  "/messages";

export async function sendWhatsAppText(to: string, body: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    throw new Error("WhatsApp is not configured");
  }

  let last: Error | undefined;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(graphUrl(), {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: {
            body: body.slice(0, 4096),
          },
        }),
      });

      const raw = await response.text();

      if (response.ok) {
        return;
      }

      let errorMessage = raw;

      try {
        const data = JSON.parse(raw);

        if (data && data.error) {
          errorMessage =
            data.error.message ||
            data.error.error_user_msg ||
            raw;
        }
      } catch {
        // Keep raw response if it is not JSON.
      }

      last = new Error(
        "WhatsApp Graph API returned " +
          response.status +
          ": " +
          errorMessage.slice(0, 1000),
      );

      if (response.status < 500 && response.status !== 429) {
        break;
      }
    } catch (error) {
      last =
        error instanceof Error
          ? error
          : new Error("WhatsApp send failed");
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 250 * (attempt + 1)),
    );
  }

  throw last || new Error("WhatsApp send failed");
}
