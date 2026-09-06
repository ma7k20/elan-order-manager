import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/mobile/update-info", (_req, res) => {
  res.json({
    version: process.env.MOBILE_UPDATE_VERSION || "",
    url: process.env.MOBILE_UPDATE_URL || "",
    message: process.env.MOBILE_UPDATE_MESSAGE || "يتوفر تحديث جديد للتطبيق.",
    required: process.env.MOBILE_UPDATE_REQUIRED === "true",
  });
});

export default router;