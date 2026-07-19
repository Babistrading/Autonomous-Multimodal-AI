import { Router, type IRouter } from "express";
import { trainingEngine } from "../lib/training/engine.js";

const router: IRouter = Router();

// GET /agents
router.get("/agents", async (_req, res): Promise<void> => {
  const agents = trainingEngine.getAgents();
  res.json(agents.map(a => ({
    id: a.id,
    name: a.name,
    type: a.type,
    status: a.status,
    lastAction: a.lastAction,
    taskCount: a.taskCount,
    createdAt: new Date().toISOString(),
  })));
});

export default router;
