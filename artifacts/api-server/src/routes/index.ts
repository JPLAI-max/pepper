import { Router, type IRouter } from "express";
import healthRouter from "./health";
import profileRouter from "./profile";
import goalsRouter from "./goals";
import roadmapRouter from "./roadmap";
import documentsRouter from "./documents";
import opportunitiesRouter from "./opportunities";
import dashboardRouter from "./dashboard";
import openaiRouter from "./openai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(profileRouter);
router.use(goalsRouter);
router.use(roadmapRouter);
router.use(documentsRouter);
router.use(opportunitiesRouter);
router.use(dashboardRouter);
router.use(openaiRouter);

export default router;
