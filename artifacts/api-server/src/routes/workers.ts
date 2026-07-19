import { Router, type IRouter } from "express";
import { trainingEngine } from "../lib/training/engine.js";

const router: IRouter = Router();

// GET /workers
router.get("/workers", async (_req, res): Promise<void> => {
  const workers = trainingEngine.getWorkers();
  res.json(workers.map(w => ({
    id: w.id,
    name: w.name,
    type: w.type,
    status: w.status,
    queueSize: w.queueSize,
    processed: w.processed,
    errors: w.errors,
    tokensPerSecond: w.tokensPerSecond,
    currentTask: w.currentTask,
  })));
});

export default router;
