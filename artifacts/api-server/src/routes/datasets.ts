import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { datasetsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GenerateDatasetBody } from "@workspace/api-zod";
import { datasetGenerator } from "../lib/training/dataset.js";

const router: IRouter = Router();

// GET /datasets
router.get("/datasets", async (_req, res): Promise<void> => {
  const datasets = await db.select().from(datasetsTable).orderBy(datasetsTable.category);
  res.json(datasets.map(d => ({
    id: d.id,
    category: d.category,
    totalSamples: d.totalSamples,
    qualityScore: d.qualityScore,
    sizeKb: d.sizeKb,
    status: d.status,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  })));
});

// GET /datasets/overview
router.get("/datasets/overview", async (_req, res): Promise<void> => {
  const datasets = await db.select().from(datasetsTable);
  const totalSamples = datasets.reduce((s, d) => s + d.totalSamples, 0);
  const totalSizeKb = datasets.reduce((s, d) => s + d.sizeKb, 0);
  const avgQuality = datasets.length > 0
    ? datasets.reduce((s, d) => s + d.qualityScore, 0) / datasets.length
    : 0;
  res.json({
    totalSamples,
    totalCategories: datasets.length,
    averageQuality: avgQuality,
    totalSizeKb,
    byCategory: datasets.map(d => ({
      category: d.category,
      count: d.totalSamples,
      quality: d.qualityScore,
    })),
  });
});

// POST /datasets/generate
router.post("/datasets/generate", async (req, res): Promise<void> => {
  const parsed = GenerateDatasetBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "category required" }); return; }
  const { category, count = 100 } = parsed.data;

  const stats = datasetGenerator.getStats();
  const catStats = stats[category as keyof typeof stats];

  // Update DB
  await db.update(datasetsTable)
    .set({
      totalSamples: catStats.sampleCount,
      qualityScore: catStats.qualityScore,
      sizeKb: catStats.sizeKb,
      status: "ready",
    })
    .where(eq(datasetsTable.category, category));

  const [updated] = await db.select().from(datasetsTable).where(eq(datasetsTable.category, category));
  res.json({
    id: updated.id,
    category: updated.category,
    totalSamples: updated.totalSamples,
    qualityScore: updated.qualityScore,
    sizeKb: updated.sizeKb,
    status: updated.status,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
});

export default router;
