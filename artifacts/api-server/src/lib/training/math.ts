/**
 * Core mathematical operations for Babis M1 — v2
 *
 * Optimized for CPU execution using Float32Arrays.
 * All operations are pure functions (no side effects except in-place variants).
 *
 * New in v2:
 *  - RMSNorm   (faster than LayerNorm; used by LLaMA/Mistral)
 *  - RoPE      (Rotary Position Embeddings; precomputed sin/cos tables)
 *  - Swish     (SiLU activation used in SwiGLU FFN)
 *  - clipGradNorm now returns the pre-clip norm for monitoring
 */

// ─── RoPE sin/cos cache ───────────────────────────────────────────────────────

const _ropeCache = new Map<string, { cos: Float32Array; sin: Float32Array }>();

/**
 * Precompute sin/cos tables for Rotary Position Embeddings.
 * Result is cached: subsequent calls with the same args are O(1).
 */
export function buildRoPETables(
  maxSeqLen: number,
  dHead: number,
): { cos: Float32Array; sin: Float32Array } {
  const key = `${maxSeqLen}-${dHead}`;
  const cached = _ropeCache.get(key);
  if (cached) return cached;

  const halfD = Math.floor(dHead / 2);
  const cos = new Float32Array(maxSeqLen * halfD);
  const sin = new Float32Array(maxSeqLen * halfD);

  for (let pos = 0; pos < maxSeqLen; pos++) {
    for (let i = 0; i < halfD; i++) {
      const theta = pos / Math.pow(10_000, (2 * i) / dHead);
      cos[pos * halfD + i] = Math.cos(theta);
      sin[pos * halfD + i] = Math.sin(theta);
    }
  }

  const tables = { cos, sin };
  _ropeCache.set(key, tables);
  return tables;
}

/**
 * Apply RoPE in-place to a Q or K tensor.
 *
 * Layout expected: qk[pos * d + head * dHead + dim]
 *   (seqLen × d, where d = nHeads × dHead)
 *
 * @param offset  Position offset for KV-cache incremental decoding.
 */
export function applyRoPE(
  qk: Float32Array,
  seqLen: number,
  d: number,
  nHeads: number,
  cos: Float32Array,
  sin: Float32Array,
  offset = 0,
): void {
  const dHead = Math.floor(d / nHeads);
  const halfD = Math.floor(dHead / 2);

  for (let pos = 0; pos < seqLen; pos++) {
    const ropeBase = (pos + offset) * halfD;
    for (let h = 0; h < nHeads; h++) {
      const base = pos * d + h * dHead;
      for (let i = 0; i < halfD; i++) {
        const c = cos[ropeBase + i];
        const s = sin[ropeBase + i];
        const i0 = base + 2 * i;
        const i1 = base + 2 * i + 1;
        const v0 = qk[i0];
        const v1 = qk[i1];
        qk[i0] = v0 * c - v1 * s;
        qk[i1] = v0 * s + v1 * c;
      }
    }
  }
}

// ─── Matrix operations ────────────────────────────────────────────────────────

/**
 * Matrix multiply: A(m×k) × B(k×n) → C(m×n)
 * Inner-loop ordering (k-loop innermost after hoisting A[i][l]) is
 * cache-friendly for row-major Float32Arrays.
 */
export function matmul(
  A: Float32Array,
  B: Float32Array,
  m: number,
  k: number,
  n: number,
): Float32Array {
  const C = new Float32Array(m * n);
  for (let i = 0; i < m; i++) {
    const iK = i * k;
    const iN = i * n;
    for (let l = 0; l < k; l++) {
      const a = A[iK + l];
      if (a === 0) continue;
      const lN = l * n;
      for (let j = 0; j < n; j++) {
        C[iN + j] += a * B[lN + j];
      }
    }
  }
  return C;
}

/** Add bias vector to each row of x(m×n) in-place. */
export function addBias(x: Float32Array, b: Float32Array, m: number, n: number): void {
  for (let i = 0; i < m; i++) {
    const off = i * n;
    for (let j = 0; j < n; j++) x[off + j] += b[j];
  }
}

/** Numerically-stable in-place row-wise softmax on x(rows×cols). */
export function softmaxRows(x: Float32Array, rows: number, cols: number): void {
  for (let i = 0; i < rows; i++) {
    const off = i * cols;
    let max = x[off];
    for (let j = 1; j < cols; j++) if (x[off + j] > max) max = x[off + j];
    let sum = 0;
    for (let j = 0; j < cols; j++) {
      x[off + j] = Math.exp(x[off + j] - max);
      sum += x[off + j];
    }
    const inv = 1 / sum;
    for (let j = 0; j < cols; j++) x[off + j] *= inv;
  }
}

// ─── Normalization ────────────────────────────────────────────────────────────

/**
 * RMSNorm: out = x / sqrt(mean(x²) + ε) * γ
 *
 * Advantages over LayerNorm:
 *  - No mean subtraction (~20% faster)
 *  - No β parameter (fewer weights to maintain)
 *  - Numerically simpler; proven effective in LLaMA, Mistral, Falcon.
 */
export function rmsNorm(
  x: Float32Array,
  gamma: Float32Array,
  n: number,
  eps = 1e-6,
): Float32Array {
  let rms = 0;
  for (let i = 0; i < n; i++) rms += x[i] * x[i];
  const scale = 1 / Math.sqrt(rms / n + eps);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = x[i] * scale * gamma[i];
  return out;
}

/** RMSNorm applied row-wise to x(rows×d). */
export function rmsNormRows(
  x: Float32Array,
  gamma: Float32Array,
  rows: number,
  d: number,
): Float32Array {
  const out = new Float32Array(rows * d);
  for (let i = 0; i < rows; i++) {
    out.set(rmsNorm(x.subarray(i * d, i * d + d), gamma, d), i * d);
  }
  return out;
}

/** Classic LayerNorm (kept for compatibility/testing). */
export function layerNorm(
  x: Float32Array,
  gamma: Float32Array,
  beta: Float32Array,
  n: number,
  eps = 1e-5,
): Float32Array {
  let mean = 0;
  for (let i = 0; i < n; i++) mean += x[i];
  mean /= n;
  let variance = 0;
  for (let i = 0; i < n; i++) variance += (x[i] - mean) ** 2;
  variance /= n;
  const std = Math.sqrt(variance + eps);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = gamma[i] * ((x[i] - mean) / std) + beta[i];
  return out;
}

/** LayerNorm applied row-wise (kept for compatibility/testing). */
export function layerNormRows(
  x: Float32Array,
  gamma: Float32Array,
  beta: Float32Array,
  rows: number,
  d: number,
): Float32Array {
  const out = new Float32Array(rows * d);
  for (let i = 0; i < rows; i++) {
    out.set(layerNorm(x.subarray(i * d, i * d + d), gamma, beta, d), i * d);
  }
  return out;
}

// ─── Activations ──────────────────────────────────────────────────────────────

/**
 * Swish / SiLU: x * σ(x)
 * Used in SwiGLU. Better gradient flow than ReLU for deep networks.
 */
export function swish(x: number): number {
  return x / (1 + Math.exp(-x));
}

/** In-place approximate GELU (kept for legacy). */
export function gelu(x: Float32Array): void {
  const c = Math.sqrt(2 / Math.PI);
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    x[i] = 0.5 * v * (1 + Math.tanh(c * (v + 0.044715 * v * v * v)));
  }
}

// ─── Loss ─────────────────────────────────────────────────────────────────────

/**
 * Causal language-modelling cross-entropy.
 * logits: (seqLen × vocabSize) — position i predicts token at i+1.
 * Returns mean loss and gradient w.r.t. logits.
 */
export function sequenceCrossEntropy(
  logits: Float32Array,
  targets: number[],
  seqLen: number,
  vocabSize: number,
): { loss: number; gradLogits: Float32Array } {
  const gradLogits = new Float32Array(seqLen * vocabSize);
  const n = seqLen - 1; // positions 0..(n-1) each predict the next token
  let totalLoss = 0;

  for (let i = 0; i < n; i++) {
    const target = targets[i + 1];
    const off = i * vocabSize;

    // Numerically-stable softmax
    let max = logits[off];
    for (let v = 1; v < vocabSize; v++) if (logits[off + v] > max) max = logits[off + v];
    const probs = new Float32Array(vocabSize);
    let sum = 0;
    for (let v = 0; v < vocabSize; v++) {
      probs[v] = Math.exp(logits[off + v] - max);
      sum += probs[v];
    }
    const invSum = 1 / sum;
    for (let v = 0; v < vocabSize; v++) probs[v] *= invSum;

    totalLoss += -Math.log(Math.max(probs[target], 1e-10));

    // ∂L/∂logits[i][v] = (probs[v] - 1{v==target}) / n
    for (let v = 0; v < vocabSize; v++) gradLogits[off + v] = probs[v] / n;
    gradLogits[off + target] -= 1 / n;
  }

  return { loss: totalLoss / n, gradLogits };
}

// ─── Initialisation ───────────────────────────────────────────────────────────

/** Xavier / Glorot normal initialisation. */
export function xavierNormal(size: number, fanIn: number, fanOut: number): Float32Array {
  const std = Math.sqrt(2 / (fanIn + fanOut));
  const arr = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const u1 = Math.random() + 1e-10;
    const u2 = Math.random();
    arr[i] = std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
  return arr;
}

/** Small normal initialisation (e.g. std=0.02 for embeddings). */
export function smallNormal(size: number, std = 0.02): Float32Array {
  const arr = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const u1 = Math.random() + 1e-10;
    const u2 = Math.random();
    arr[i] = std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
  return arr;
}

/**
 * Clip gradient arrays by global L2 norm.
 * Returns the pre-clip global norm (useful for monitoring gradient health).
 */
export function clipGradNorm(grads: Float32Array[], maxNorm: number): number {
  let totalNorm = 0;
  for (const g of grads) {
    for (let i = 0; i < g.length; i++) totalNorm += g[i] * g[i];
  }
  totalNorm = Math.sqrt(totalNorm);
  if (totalNorm > maxNorm) {
    const scale = maxNorm / (totalNorm + 1e-6);
    for (const g of grads) {
      for (let i = 0; i < g.length; i++) g[i] *= scale;
    }
  }
  return totalNorm;
}
