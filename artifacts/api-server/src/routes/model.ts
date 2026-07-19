import { Router, type IRouter } from "express";
import { FULL_SPEC, ACTIVE_CONFIG, countParams } from "../lib/training/config.js";
import { tokenizer } from "../lib/training/tokenizer.js";

const router: IRouter = Router();

// GET /model/info
router.get("/model/info", async (_req, res): Promise<void> => {
  const fullParams = countParams(FULL_SPEC);
  const activeParams = countParams(ACTIVE_CONFIG);
  // weights + grads + 2 AdamW moments, float32
  const memoryMb = Math.round((activeParams * 4 * 4) / (1024 * 1024));

  res.json({
    name: "Babis M1",
    version: "1.0.0",
    architecture: "GPT-style Causal Transformer",
    // Full 248M parameter specification (requires GPU for full training)
    parameters: fullParams,
    layers: FULL_SPEC.nLayers,
    heads: FULL_SPEC.nHeads,
    dModel: FULL_SPEC.dModel,
    dFf: FULL_SPEC.dFf,
    vocabSize: FULL_SPEC.vocabSize,
    maxSeqLen: FULL_SPEC.maxSeqLen,
    // Active training core running on CPU
    activeParameters: activeParams,
    activeLayers: ACTIVE_CONFIG.nLayers,
    activeHeads: ACTIVE_CONFIG.nHeads,
    activeDModel: ACTIVE_CONFIG.dModel,
    activeDFf: ACTIVE_CONFIG.dFf,
    activeVocabSize: ACTIVE_CONFIG.vocabSize,
    activeMaxSeqLen: ACTIVE_CONFIG.maxSeqLen,
    memoryMb,
  });
});

// GET /model/tokenizer/stats
router.get("/model/tokenizer/stats", async (_req, res): Promise<void> => {
  const stats = tokenizer.getStats();
  res.json({
    algorithm: stats.algorithm,
    vocabSize: stats.vocabSize,
    specialTokens: stats.specialTokens,
    totalTokensSeen: stats.totalTokensSeen,
    uniqueTokens: stats.uniqueTokens,
    averageTokenLength: stats.averageTokenLength,
    compressionRatio: stats.compressionRatio,
    mostFrequent: stats.mostFrequent,
    languageDistribution: stats.languageDistribution,
  });
});

export default router;
