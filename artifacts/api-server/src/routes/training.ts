import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { trainingMetricsTable, trainingLogsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { StartTrainingBody, SetPowerModeBody, GetTrainingMetricsQueryParams, GetTrainingLogsQueryParams } from "@workspace/api-zod";
import { trainingEngine } from "../lib/training/engine.js";

const router: IRouter = Router();

// GET /training/status
router.get("/training/status", async (_req, res): Promise<void> => {
  const s = trainingEngine.getStatus();
  res.json({
    status: s.status,
    epoch: s.epoch,
    step: s.step,
    loss: s.loss,
    validationLoss: s.validationLoss,
    perplexity: s.perplexity,
    learningRate: s.learningRate,
    tokensProcessed: s.tokensProcessed,
    tokensPerSecond: s.tokensPerSecond,
    trainingTimeSeconds: s.trainingTimeSeconds,
    powerMode: s.powerMode,
    activeWorkers: s.activeWorkers,
    startedAt: s.startedAt?.toISOString() ?? null,
  });
});

// POST /training/start
router.post("/training/start", async (req, res): Promise<void> => {
  const parsed = StartTrainingBody.safeParse(req.body);
  const powerMode = (parsed.success && parsed.data.powerMode) ? parsed.data.powerMode : "medium";
  await trainingEngine.start(powerMode as any);
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

// POST /training/stop
router.post("/training/stop", async (_req, res): Promise<void> => {
  await trainingEngine.stop();
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

// POST /training/pause
router.post("/training/pause", async (_req, res): Promise<void> => {
  await trainingEngine.pause();
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

// POST /training/resume
router.post("/training/resume", async (_req, res): Promise<void> => {
  await trainingEngine.resume();
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

// POST /training/power-mode
router.post("/training/power-mode", async (req, res): Promise<void> => {
  const parsed = SetPowerModeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid power mode" }); return; }
  await trainingEngine.setPowerMode(parsed.data.powerMode as any);
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

// POST /training/checkpoint
router.post("/training/checkpoint", async (_req, res): Promise<void> => {
  const ckpt = await trainingEngine.saveCheckpoint();
  res.status(201).json({
    id: ckpt.id,
    name: ckpt.name,
    epoch: trainingEngine.getStatus().epoch,
    step: trainingEngine.getStatus().step,
    loss: trainingEngine.getStatus().loss ?? 0,
    sizeMb: ckpt.sizeMb,
    isActive: true,
    createdAt: new Date().toISOString(),
  });
});

// GET /training/metrics
router.get("/training/metrics", async (req, res): Promise<void> => {
  const qp = GetTrainingMetricsQueryParams.safeParse(req.query);
  const limit = qp.success && qp.data.limit ? Number(qp.data.limit) : 200;
  const metrics = await db.select().from(trainingMetricsTable)
    .orderBy(desc(trainingMetricsTable.createdAt))
    .limit(limit);
  res.json(metrics.reverse().map(m => ({
    id: m.id,
    epoch: m.epoch,
    step: m.step,
    loss: m.loss,
    validationLoss: m.validationLoss,
    perplexity: m.perplexity,
    learningRate: m.learningRate,
    tokensPerSecond: m.tokensPerSecond,
    createdAt: m.createdAt.toISOString(),
  })));
});

// GET /training/logs
router.get("/training/logs", async (req, res): Promise<void> => {
  const qp = GetTrainingLogsQueryParams.safeParse(req.query);
  const limit = qp.success && qp.data.limit ? Number(qp.data.limit) : 50;
  const logs = await db.select().from(trainingLogsTable)
    .orderBy(desc(trainingLogsTable.createdAt))
    .limit(limit);
  res.json(logs.reverse().map(l => ({
    id: l.id,
    level: l.level,
    message: l.message,
    workerName: l.workerName,
    createdAt: l.createdAt.toISOString(),
  })));
});

export default router;
