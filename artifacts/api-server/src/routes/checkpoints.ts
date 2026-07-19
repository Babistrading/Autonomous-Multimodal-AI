import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { checkpointsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { trainingEngine } from "../lib/training/engine.js";

const router: IRouter = Router();

// GET /checkpoints
router.get("/checkpoints", async (_req, res): Promise<void> => {
  const checkpoints = await db.select().from(checkpointsTable).orderBy(desc(checkpointsTable.createdAt));
  res.json(checkpoints.map(c => ({
    id: c.id,
    name: c.name,
    epoch: c.epoch,
    step: c.step,
    loss: c.loss,
    sizeMb: c.sizeMb,
    isActive: c.isActive,
    createdAt: c.createdAt.toISOString(),
  })));
});

// POST /checkpoints/:checkpointId/load
router.post("/checkpoints/:checkpointId/load", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.checkpointId) ? req.params.checkpointId[0] : req.params.checkpointId;
  const checkpointId = parseInt(raw, 10);
  if (isNaN(checkpointId)) { res.status(400).json({ error: "Invalid checkpointId" }); return; }
  await trainingEngine.loadCheckpoint(checkpointId);
  const s = trainingEngine.getStatus();
  res.json({
    status: s.status, epoch: s.epoch, step: s.step, loss: s.loss,
    validationLoss: s.validationLoss, perplexity: s.perplexity,
    learningRate: s.learningRate, tokensProcessed: s.tokensProcessed,
    tokensPerSecond: s.tokensPerSecond, trainingTimeSeconds: s.trainingTimeSeconds,
    powerMode: s.powerMode, activeWorkers: s.activeWorkers,
    startedAt: s.startedAt?.toISOString() ?? null,
  });
});

export default router;
