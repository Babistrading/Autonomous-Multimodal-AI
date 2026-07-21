/**
 * Babis M1 model configurations — v2 (SwiGLU / RoPE / RMSNorm / Weight-Tying)
 *
 * Architecture:
 *  - FFN: SwiGLU(Wgate, Wup, Wdown) — 3 matrices
 *  - Norm: RMSNorm  (no mean subtraction, no β)
 *  - Pos:  RoPE     (no stored posEmbed table)
 *  - Head: tied to tokenEmbed  (weight tying)
 */

export interface ModelConfig {
  dModel: number;
  nLayers: number;
  nHeads: number;
  /** Inner dimension for SwiGLU gate / up projections (≈ (8/3)·dModel is standard). */
  dFf: number;
  vocabSize: number;
  maxSeqLen: number;
}

export interface HyperParams {
  /** AdamW β₁ — first moment decay */
  beta1: number;
  /** AdamW β₂ — second moment decay */
  beta2: number;
  /** AdamW ε — numerical stability */
  epsilon: number;
  /** L2 weight decay coefficient */
  weightDecay: number;
  /** Gradient clipping max norm */
  gradientClip: number;
  /** LR warmup steps */
  warmupSteps: number;
  /** Total training steps for cosine schedule */
  totalSteps: number;
  /** Minimum LR fraction at end of cosine schedule */
  minLrFraction: number;
  /** Gradient accumulation steps before optimizer update */
  gradAccum: number;
}

export const DEFAULT_HYPERPARAMS: HyperParams = {
  beta1: 0.9,
  beta2: 0.95,
  epsilon: 1e-8,
  weightDecay: 0.1,
  gradientClip: 1.0,
  warmupSteps: 200,
  totalSteps: 500_000,
  minLrFraction: 0.1,
  gradAccum: 4,
};

/**
 * Full Babis M1 architecture specification — 208M parameters.
 * Requires GPU for full training. Displayed in the dashboard.
 */
export const FULL_SPEC: ModelConfig = {
  dModel: 768,
  nLayers: 24,
  nHeads: 12,
  dFf: 2048,
  vocabSize: 50_000,
  maxSeqLen: 2048,
};

/**
 * Active training core — ~1M parameters running on CPU.
 * Architecturally identical to FULL_SPEC, scaled to ~1M params.
 * dFf = 320 ≈ (8/3)·128, keeping SwiGLU proportions.
 * vocabSize is overwritten at runtime to match the real BPE vocabulary.
 *
 * Parameter count (V≈1978 BPE):
 *   tokenEmbed  = V × 128       ≈ 253K
 *   per layer   = 4·128² + 3·128·320 + 2·128
 *               = 65,536 + 122,880 + 256  = 188,672
 *   4 layers    = 754,688
 *   finalGamma  = 128
 *   Total       ≈ 1.008M parameters
 */
export const ACTIVE_CONFIG: ModelConfig = {
  dModel: 128,
  nLayers: 4,
  nHeads: 4,
  dFf: 320,
  vocabSize: 8_000,   // overwritten by BPE init
  maxSeqLen: 128,
};

/**
 * Exact parameter count for the v2 architecture.
 *
 * Formula:
 *   tokenEmbed       = V × d          (also serves as lmHead — weight-tied)
 *   posEmbed         = 0              (RoPE — no stored table)
 *   per layer:
 *     attention      = 4 × d²         (Wq, Wk, Wv, Wo)
 *     SwiGLU FFN     = 3 × d × dFf   (Wgate, Wup, Wdown)
 *     RMSNorm        = 2 × d          (rms1, rms2 — γ only, no β)
 *   finalRmsGamma    = d
 *   lmHead           = 0              (tied to tokenEmbed)
 */
export function countParams(cfg: ModelConfig): number {
  const { dModel: d, nLayers: L, dFf, vocabSize: V } = cfg;
  const perLayer = 4 * d * d + 3 * d * dFf + 2 * d;
  return V * d + L * perLayer + d;
}

export type PowerMode = "low" | "medium" | "high" | "max";

/**
 * Power mode configs tuned for the 1M-parameter active model on CPU.
 * seqLen is kept short to maintain reasonable step speed.
 */
export const POWER_CONFIGS: Record<
  PowerMode,
  { batchSize: number; seqLen: number; lr: number; workers: number; gradAccum: number }
> = {
  low:    { batchSize: 1, seqLen: 16, lr: 1e-4,  workers: 2,  gradAccum: 1 },
  medium: { batchSize: 1, seqLen: 24, lr: 3e-4,  workers: 5,  gradAccum: 2 },
  high:   { batchSize: 1, seqLen: 32, lr: 5e-4,  workers: 8,  gradAccum: 4 },
  max:    { batchSize: 2, seqLen: 48, lr: 8e-4,  workers: 11, gradAccum: 8 },
};

export const WORKER_DEFINITIONS = [
  { id: 1,  name: "Language Worker 1",  type: "language", category: "language" },
  { id: 2,  name: "Language Worker 2",  type: "language", category: "language" },
  { id: 3,  name: "Language Worker 3",  type: "language", category: "language" },
  { id: 4,  name: "Language Worker 4",  type: "language", category: "language" },
  { id: 5,  name: "Language Worker 5",  type: "language", category: "language" },
  { id: 6,  name: "Language Worker 6",  type: "language", category: "language" },
  { id: 7,  name: "Language Worker 7",  type: "language", category: "language" },
  { id: 8,  name: "Language Worker 8",  type: "language", category: "language" },
  { id: 9,  name: "Language Worker 9",  type: "language", category: "language" },
  { id: 10, name: "Language Worker 10", type: "language", category: "language" },
  { id: 11, name: "Language Worker 11", type: "language", category: "language" },
] as const;

export const AGENT_DEFINITIONS = [
  { id: 1, name: "Coding Agent",              type: "coding",     actions: ["Analyzing code patterns", "Generating examples", "Optimizing syntax"] },
  { id: 2, name: "Research Agent",            type: "research",   actions: ["Collecting knowledge", "Indexing information", "Cross-referencing data"] },
  { id: 3, name: "Reasoning Agent",           type: "reasoning",  actions: ["Solving logic problems", "Building inference chains", "Validating proofs"] },
  { id: 4, name: "Debug Agent",               type: "debug",      actions: ["Scanning for errors", "Tracing execution", "Fixing inconsistencies"] },
  { id: 5, name: "Training Supervisor Agent", type: "supervisor", actions: ["Monitoring loss curves", "Adjusting hyperparameters", "Coordinating workers"] },
  { id: 6, name: "Memory Agent",              type: "memory",     actions: ["Consolidating experiences", "Building context", "Managing long-term memory"] },
  { id: 7, name: "Security Agent",            type: "security",   actions: ["Scanning for vulnerabilities", "Auditing outputs", "Enforcing safety"] },
  { id: 8, name: "Deployment Agent",          type: "deployment", actions: ["Preparing model artifacts", "Validating checkpoints", "Managing versions"] },
] as const;
