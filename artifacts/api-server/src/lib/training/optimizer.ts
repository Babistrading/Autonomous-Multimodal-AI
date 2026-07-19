/**
 * AdamW optimizer with cosine learning rate schedule.
 * All operations use Float32Arrays directly for efficiency.
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

  /** Collect all trainable parameter arrays from weights struct */
  private getParamArrays(weights: ModelWeights): Float32Array[] {
    const arrays: Float32Array[] = [weights.tokenEmbed, weights.lmHead];
    for (const layer of weights.layers) {
      arrays.push(layer.Wq, layer.Wk, layer.Wv, layer.Wo, layer.W1, layer.W2);
      arrays.push(layer.ln1Gamma, layer.ln1Beta, layer.ln2Gamma, layer.ln2Beta);
    }
    arrays.push(weights.finalLnGamma, weights.finalLnBeta);
    return arrays;
  }

  /** Initialize moment buffers if needed */
  private ensureInit(params: Float32Array[]): void {
    if (this.m.length === 0) {
      this.m = params.map(p => new Float32Array(p.length));
      this.v = params.map(p => new Float32Array(p.length));
    }
  }

  /** One AdamW step on all parameters */
  step(weights: ModelWeights, grads: ModelWeights, currentLr?: number): void {
    this.t++;
    const lr = currentLr ?? this.lr;

    const params = this.getParamArrays(weights);
    const gradArrays = this.getParamArrays(grads);

    this.ensureInit(params);

    // Clip gradients
    clipGradNorm(gradArrays, this.maxGradNorm);

    const bc1 = 1 - Math.pow(this.beta1, this.t);
    const bc2 = 1 - Math.pow(this.beta2, this.t);

    for (let i = 0; i < params.length; i++) {
      const p = params[i];
      const g = gradArrays[i];
      const m = this.m[i];
      const v = this.v[i];

      for (let j = 0; j < p.length; j++) {
        const gj = g[j];
        m[j] = this.beta1 * m[j] + (1 - this.beta1) * gj;
        v[j] = this.beta2 * v[j] + (1 - this.beta2) * gj * gj;
        const mHat = m[j] / bc1;
        const vHat = v[j] / bc2;
        // AdamW: weight decay applied directly to weights (decoupled)
        p[j] -= lr * (mHat / (Math.sqrt(vHat) + this.eps) + this.wd * p[j]);
      }

      // Zero gradients after update
      g.fill(0);
    }
  }

  setLr(lr: number): void { this.lr = lr; }
  getLr(): number { return this.lr; }
  getStep(): number { return this.t; }
}

/**
 * Cosine learning rate schedule with linear warmup.
 * Returns learning rate multiplier for the given step.
 */
export function cosineLrSchedule(
  step: number,
  baseLr: number,
  warmupSteps: number,
  totalSteps: number,
  minLrFraction = 0.1,
): number {
  if (step < warmupSteps) {
    return baseLr * (step / Math.max(warmupSteps, 1));
  }
  const progress = (step - warmupSteps) / Math.max(totalSteps - warmupSteps, 1);
  const cosineDecay = 0.5 * (1 + Math.cos(Math.PI * Math.min(progress, 1)));
  return baseLr * (minLrFraction + (1 - minLrFraction) * cosineDecay);
}
