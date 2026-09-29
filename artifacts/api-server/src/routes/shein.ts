import { Router, type IRouter } from "express";
import { getCart } from "shein-cart";

const router: IRouter = Router();

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

    const items = cart.items.map((item: any) => {
      // SHEIN يرجع اللون والمقاس عادة بهذا الشكل:
      // "שחור / L"
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

        // لا نعتمد أسعار SHEIN تلقائياً.
        // المستخدم سيدخل السعر قبل تأكيد الطلب.
        sellingPrice: null,
        commission: null,
        sheinCost: null,

        stock: item.stock ?? null,
        soldOut: Boolean(item.soldOut),
        status: item.status || "normal",
      };
    });

    return res.json({
      success: true,

      cart: {
        groupId: cart.groupId,
        count: cart.count,
        availableCount: cart.availableCount,
      },

      items,
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