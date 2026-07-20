/**
 * Tokenizer entry point for Babis M1.
 *
 * Re-exports the BPE tokenizer as a backward-compatible `tokenizer` proxy.
 * All internal modules (dataset.ts, engine.ts) import from here.
 *
 * Initialization flow:
 *   1. Server startup calls `initTokenizer()` once (async)
 *   2. Training starts, all calls to `tokenizer.*` work synchronously via `getTokenizer()`
 */

export {
  initTokenizer,
  getTokenizer,
  BPETokenizer,
} from "./tokenizer/BPETokenizer.js";

export type { TokenizerStats } from "./tokenizer/BPETokenizer.js";

import { getTokenizer, initTokenizer } from "./tokenizer/BPETokenizer.js";
import type { TokenizerStats } from "./tokenizer/BPETokenizer.js";

const FALLBACK_STATS: TokenizerStats = {
  algorithm: "BPE (initializing...)",
  vocabSize: 0,
  specialTokens: 10,
  totalTokensSeen: 0,
  uniqueTokens: 0,
  averageTokenLength: 0,
  compressionRatio: 0,
  mostFrequent: [],
  languageDistribution: {},
};

/**
 * Lazy synchronous proxy.
 * Falls back gracefully if called before `initTokenizer()` resolves.
 * After server startup completes initialization, all calls succeed normally.
 */
export const tokenizer = {
  get vocabSize(): number {
    try { return getTokenizer().vocabSize; } catch { return 50000; }
  },

  encode(text: string, addBos = false, addEos = false): number[] {
    try { return getTokenizer().encode(text, addBos, addEos); } catch { return [2]; }
  },

  decode(tokenIds: number[]): string {
    try { return getTokenizer().decode(tokenIds); } catch { return ""; }
  },

  encodeBatch(texts: string[]): number[][] {
    try { return getTokenizer().encodeBatch(texts); } catch { return texts.map(() => [2]); }
  },

  getStats(): TokenizerStats {
    try { return getTokenizer().getStats(); } catch { return FALLBACK_STATS; }
  },
};
