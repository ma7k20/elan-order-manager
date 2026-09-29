import { Router, type IRouter } from "express";
import { getCart } from "shein-cart";
import { getAiSettings } from "../services/ai/settings";

const router: IRouter = Router();

type SheinItem = {
  sheinProductId: string;
  sheinSn: string;
  sku: string;
  name: string;
  color: string;
  size: string;
  image: string;
  productUrl: string;
  quantity: number;
  sellingPrice: null;
  commission: null;
  sheinCost: null;
  stock: number | null;
  soldOut: boolean;
  status: string;
};

async function translateItemsToArabic(items: SheinItem[]) {
  try {
    const settings = await getAiSettings();
    const { ai } = await import("@workspace/integrations-gemini-ai");

    const translationInput = items.map((item, index) => ({
      index,
      name: item.name,
      color: item.color,
    }));

    const result = await ai.models.generateContent({
      model: settings.model,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `
ترجم بيانات منتجات SHEIN التالية إلى العربية.

القواعد:
- ترجم name إلى اسم عربي واضح ومختصر للمنتج.
- ترجم color إلى العربية.
- لا تضف أي معلومات غير موجودة.
- لا تغير ترتيب المنتجات.
- أعد JSON فقط بدون Markdown وبدون أي شرح.
- يجب أن يكون الشكل بالضبط:
[
  {
    "index": 0,
    "name": "الاسم بالعربية",
    "color": "اللون بالعربية"
  }
]

البيانات:
${JSON.stringify(translationInput)}
              `.trim(),
            },
          ],
        },
      ],
      config: {
        temperature: 0,
      },
    });

    let text = (result.text || "").trim();

    // احتياط في حال أرجع Gemini الكود داخل Markdown.
    text = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const translated = JSON.parse(text);

    if (!Array.isArray(translated)) {
      throw new Error("Invalid translation response");
    }

    const translatedMap = new Map<
      number,
      { name?: string; color?: string }
    >();

    for (const item of translated) {
      if (typeof item?.index === "number") {
        translatedMap.set(item.index, {
          name: typeof item.name === "string" ? item.name.trim() : "",
          color: typeof item.color === "string" ? item.color.trim() : "",
        });
      }
    }

    return items.map((item, index) => {
      const translation = translatedMap.get(index);

      return {
        ...item,
        name: translation?.name || item.name,
        color: translation?.color || item.color,
      };
    });
  } catch (error) {
    console.error("SHEIN ARABIC TRANSLATION ERROR:", error);

    // مهم: فشل Gemini لا يفشل استيراد السلة.
    return items;
  }
}

router.post("/shein/import-cart", async (req, res) => {
  try {
    const { url } = req.body ?? {};

    if (!url || typeof url !== "string") {
      return res.status(400).json({
        success: false,
        message: "رابط سلة SHEIN مطلوب",
      });
    }

    const cart = await getCart(url, {
      currency: "ILS",
    });

    const items: SheinItem[] = cart.items.map((item: any) => {
      const attributes = String(item.attr || "")
        .split("/")
        .map((value) => value.trim())
        .filter(Boolean);

      return {
        sheinProductId: item.id || "",
        sheinSn: item.sn || "",
        sku: item.sku || "",

        name: item.name || "",

        color: attributes[0] || "",
        size: attributes[1] || "",

        image: item.image || "",
        productUrl: item.url || "",

        quantity: 1,

        sellingPrice: null,
        commission: null,
        sheinCost: null,

        stock: item.stock ?? null,
        soldOut: Boolean(item.soldOut),
        status: item.status || "normal",
      };
    });

    // نحاول تعريب الاسم واللون فقط.
    // SKU والمقاس وباقي البيانات لا تتغير.
    const translatedItems = await translateItemsToArabic(items);

    return res.json({
      success: true,

      cart: {
        groupId: cart.groupId,
        count: cart.count,
        availableCount: cart.availableCount,
      },

      items: translatedItems,
    });
  } catch (error: any) {
    console.error("SHEIN IMPORT ERROR:", error);

    return res.status(error?.status || 500).json({
      success: false,
      message:
        error?.message ||
        "حدث خطأ أثناء قراءة سلة SHEIN",
    });
  }
});

export default router;