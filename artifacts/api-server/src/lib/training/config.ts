/**
 * Babis M1 model configurations — v2 (SwiGLU / RoPE / RMSNorm / Weight-Tying)
 *
 * Architecture changes from v1:
 *  - FFN: GELU(W1·W2)  →  SwiGLU(Wgate, Wup, Wdown) — 3 matrices, smaller dFf
 *  - Norm: LayerNorm   →  RMSNorm  (no mean subtraction, no β)
 *  - Pos:  learned PE  →  RoPE     (no stored posEmbed table)
 *  - Head: separate lmHead → tied to tokenEmbed  (weight tying)
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

/**
 * Full Babis M1 architecture specification — 208M parameters.
 * Requires GPU for full training. Displayed in the dashboard.
 * Uses dFf = 2048 ≈ (8/3)·768, matching LLaMA-style FFN width.
 */
export const FULL_SPEC: ModelConfig = {
  dModel: 768,
  nLayers: 24,
  nHeads: 12,
  dFf: 2048,          // SwiGLU inner dim (3 matrices × 768 × 2048 × 24 layers)
  vocabSize: 50_000,
  maxSeqLen: 2048,
};

/**
 * Active training core — runs on CPU.
 * Architecturally identical to FULL_SPEC, scaled for available memory.
 * Uses dFf = 352 ≈ (8/3)·128, keeping FFN parameter parity with old dFf=512.
 * vocabSize is updated at runtime to match the real BPE vocabulary.
 */
export const ACTIVE_CONFIG: ModelConfig = {
  dModel: 128,
  nLayers: 4,
  nHeads: 4,
  dFf: 352,           // SwiGLU inner dim (3 × 128 × 352 × 4 layers ≈ same as 2 × 128 × 512)
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

// FULL_SPEC  ≈ 208,306,944 parameters
// ACTIVE_CONFIG (V=1978 BPE) ≈ 1,057,152 parameters

export type PowerMode = "low" | "medium" | "high" | "max";

export const POWER_CONFIGS: Record<
  PowerMode,
  { batchSize: number; seqLen: number; lr: number; workers: number; gradAccum: number }
> = {
  low:    { batchSize: 1, seqLen: 32,  lr: 1e-4,  workers: 2,  gradAccum: 1 },
  medium: { batchSize: 1, seqLen: 64,  lr: 3e-4,  workers: 4,  gradAccum: 2 },
  high:   { batchSize: 2, seqLen: 96,  lr: 5e-4,  workers: 7,  gradAccum: 4 },
  max:    { batchSize: 4, seqLen: 128, lr: 1e-3,  workers: 11, gradAccum: 8 },
};

export const WORKER_DEFINITIONS = [
  { id: 1,  name: "Language Worker",    type: "language",    category: "language"    },
  { id: 2,  name: "Code Worker",        type: "code",        category: "coding"      },
  { id: 3,  name: "Math Worker",        type: "math",        category: "math"        },
  { id: 4,  name: "Reasoning Worker",   type: "reasoning",   category: "reasoning"   },
  { id: 5,  name: "Science Worker",     type: "science",     category: "science"     },
  { id: 6,  name: "Vision Worker",      type: "vision",      category: "language"    },
  { id: 7,  name: "Instruction Worker", type: "instruction", category: "instruction" },
  { id: 8,  name: "Dataset Worker",     type: "dataset",     category: "language"    },
  { id: 9,  name: "Tokenizer Worker",   type: "tokenizer",   category: "language"    },
  { id: 10, name: "Validation Worker",  type: "validation",  category: "language"    },
  { id: 11, name: "Checkpoint Worker",  type: "checkpoint",  category: "language"    },
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
