/**
 * AdamW optimizer compatible with Babis M1 Transformer v2
 * RMSNorm + SwiGLU + Weight Tying
 */

import type { ModelWeights } from "./transformer.js";
import { clipGradNorm } from "./math.js";

export class AdamW {
  private t = 0;
  private m: Float32Array[] = [];
  private v: Float32Array[] = [];

  private readonly beta1 = 0.9;
  private readonly beta2 = 0.999;
  private readonly eps = 1e-8;

  constructor(
    private lr: number = 3e-4,
    private wd: number = 0.01,
    private maxGradNorm: number = 1.0,
  ) {}

  /**
   * Returns every trainable Float32Array exactly once.
   * lmHead is NOT included because it is tied to tokenEmbed.
   */
  private getParamArrays(weights: ModelWeights): Float32Array[] {
    const arrays: Float32Array[] = [];

    arrays.push(weights.tokenEmbed);

    for (const layer of weights.layers) {
      arrays.push(
        layer.Wq,
        layer.Wk,
        layer.Wv,
        layer.Wo,

        layer.Wgate,
        layer.Wup,
        layer.Wdown,

        layer.rms1,
        layer.rms2,
      );
    }

    arrays.push(weights.finalRmsGamma);

    return arrays;
  }

  private ensureInit(params: Float32Array[]): void {
    if (this.m.length !== params.length) {
      this.m = params.map((p) => new Float32Array(p.length));
      this.v = params.map((p) => new Float32Array(p.length));
    }
  }

  step(weights: ModelWeights, grads: ModelWeights, currentLr?: number): void {
    this.t++;

    const lr = currentLr ?? this.lr;

    const params = this.getParamArrays(weights);
    const gradArrays = this.getParamArrays(grads);

    this.ensureInit(params);

    clipGradNorm(gradArrays, this.maxGradNorm);

    const bc1 = 1 - Math.pow(this.beta1, this.t);
    const bc2 = 1 - Math.pow(this.beta2, this.t);

    for (let i = 0; i < params.length; i++) {
      const p = params[i];
      const g = gradArrays[i];
      const m = this.m[i];
      const v = this.v[i];

      if (!p || !g) continue;

      for (let j = 0; j < p.length; j++) {
        const grad = g[j];

        m[j] = this.beta1 * m[j] + (1 - this.beta1) * grad;
        v[j] = this.beta2 * v[j] + (1 - this.beta2) * grad * grad;

        const mHat = m[j] / bc1;
        const vHat = v[j] / bc2;

        p[j] -= lr * (mHat / (Math.sqrt(vHat) + this.eps) + this.wd * p[j]);
      }

      g.fill(0);
    }
  }

  setLr(lr: number): void {
    this.lr = lr;
  }

  getLr(): number {
    return this.lr;
  }

  getStep(): number {
    return this.t;
  }
}

/**
 * Cosine LR schedule with warmup
 */
export function cosineLrSchedule(
  step: number,
  baseLr: number,
  warmupSteps: number,
  totalSteps: number,
  minLrFraction = 0.1,
): number {
  if (step < warmupSteps) {
    return (baseLr * step) / Math.max(warmupSteps, 1);
  }

  const progress = (step - warmupSteps) / Math.max(totalSteps - warmupSteps, 1);

  const cosine = 0.5 * (1 + Math.cos(Math.PI * Math.min(progress, 1)));

  return baseLr * (minLrFraction + (1 - minLrFraction) * cosine);
}
