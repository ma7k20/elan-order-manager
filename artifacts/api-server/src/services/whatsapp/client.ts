const graphUrl = () => `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_API_VERSION || "v21.0"}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

export async function sendWhatsAppText(to: string, body: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token || !process.env.WHATSAPP_PHONE_NUMBER_ID) throw new Error("WhatsApp is not configured");
  let last: Error | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(graphUrl(), { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: body.slice(0, 4096) } }) });
      if (response.ok) return;
      last = new Error(`WhatsApp Graph API returned ${response.status}`);
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) { last = error instanceof Error ? error : new Error("WhatsApp send failed"); }
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  throw last ?? new Error("WhatsApp send failed");
}