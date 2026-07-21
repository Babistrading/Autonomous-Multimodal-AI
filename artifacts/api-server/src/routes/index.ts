import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import chatRouter from "./chat.js";
import trainingRouter from "./training.js";
import workersRouter from "./workers.js";
import datasetsRouter from "./datasets.js";
import checkpointsRouter from "./checkpoints.js";
import agentsRouter from "./agents.js";
import modelRouter from "./model.js";
import hardwareRouter from "./hardware.js";
import iosRouter from "./ios.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(trainingRouter);
router.use(workersRouter);
router.use(datasetsRouter);
router.use(checkpointsRouter);
router.use(agentsRouter);
router.use(modelRouter);
router.use(hardwareRouter);
router.use(iosRouter);

export default router;
