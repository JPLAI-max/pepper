import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import passkeyRouter from "./passkey";
import profileRouter from "./profile";
import goalsRouter from "./goals";
import roadmapRouter from "./roadmap";
import documentsRouter from "./documents";
import opportunitiesRouter from "./opportunities";
import scoresRouter from "./scores";
import dashboardRouter from "./dashboard";
import storageRouter from "./storage";
import openaiRouter from "./openai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(passkeyRouter);
router.use(profileRouter);
router.use(goalsRouter);
router.use(roadmapRouter);
router.use(documentsRouter);
router.use(opportunitiesRouter);
router.use(scoresRouter);
router.use(dashboardRouter);
router.use(storageRouter);
router.use(openaiRouter);

export default router;
