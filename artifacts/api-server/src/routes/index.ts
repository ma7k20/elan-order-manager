import { Router, type IRouter } from "express";
import healthRouter from "./health";
import businessRouter from "./business";
import storageRouter from "./storage";
import authRouter from "./auth";
import aiRouter from "./ai";
import whatsappRouter from "./whatsapp";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(whatsappRouter);
router.use(aiRouter);
router.use(businessRouter);
router.use(storageRouter);

export default router;
