/**
 * Byte Pair Encoding (BPE) Trainer for Babis M1.
 *
 * Implements the algorithm from Sennrich et al. (2016):
 * "Neural Machine Translation of Rare Words with Subword Units"
 * Extended with byte-level encoding (GPT-2 style) for universal coverage.
 *
 * Every token in the resulting vocabulary comes from corpus statistics —
 * no artificial or placeholder tokens are ever generated.
 */

import { TextEncoder } from "util";

// ─── Byte↔Unicode Mapping (GPT-2 style) ─────────────────────────────────────
//
// Maps each of the 256 possible bytes to a unique, printable Unicode character.
// Printable ASCII (33-126) and Latin-1 printable (161-172, 174-255) map to
// themselves. Remaining 68 bytes map to chars starting at codepoint 256.
//
// This guarantees:
//  1. All input text can be encoded without [UNK]
//  2. Perfect round-trip: encode → decode gives exact original bytes
//  3. All vocab tokens are printable (useful for debugging)

function buildByteMaps(): { enc: string[]; dec: Map<string, number> } {
  const printable = new Set<number>();
  for (let b = 33; b <= 126; b++) printable.add(b);
  for (let b = 161; b <= 172; b++) printable.add(b);
  for (let b = 174; b <= 255; b++) printable.add(b);

  const enc = new Array<string>(256);
  const dec = new Map<string, number>();
  let n = 256; // Next codepoint for non-printable bytes

  for (let b = 0; b < 256; b++) {
    const c = String.fromCodePoint(printable.has(b) ? b : n++);
    enc[b] = c;
    dec.set(c, b);
  }
  return { enc, dec };
}

const _maps = buildByteMaps();
/** byte → unicode char (length-256 array, index = byte value) */
export const BYTE_ENC: readonly string[] = _maps.enc;
/** unicode char → byte value */
export const BYTE_DEC: ReadonlyMap<string, number> = _maps.dec;

// Separator for pair keys — in Unicode private use area, never in byte-encoded text
const SEP = "\uE000";

// ─── Pre-tokenization ─────────────────────────────────────────────────────────
//
// GPT-2 style regex splits text into natural linguistic units before BPE.
// This prevents unnatural merges across word boundaries (e.g., "the" + " cat").

const PRETOK_REGEX =
  /(?:'s|'t|'re|'ve|'m|'ll|'d)|[^\r\n\p{L}\p{N}]?\p{L}+|\p{N}+| ?[^\s\p{L}\p{N}]+|\s+/gu;

/** Split text into pre-tokens (linguistic units) */
export function pretokenize(text: string): string[] {
  return [...text.matchAll(PRETOK_REGEX)].map((m) => m[0]);
}

/** Convert a pre-token string to its byte-level unicode representation */
export function toByteLevelStr(word: string): string {
  const bytes = new TextEncoder().encode(word);
  return Array.from(bytes)
    .map((b) => BYTE_ENC[b])
    .join("");
}

// ─── Special Tokens ───────────────────────────────────────────────────────────

export const SPECIAL_TOKENS: Readonly<Record<string, number>> = {
  "[PAD]": 0,
  "[UNK]": 1,
  "[BOS]": 2,
  "[EOS]": 3,
  "[SYSTEM]": 4,
  "[USER]": 5,
  "[ASSISTANT]": 6,
  "[CODE]": 7,
  "[MATH]": 8,
  "[REASONING]": 9,
} as const;

export const NUM_SPECIAL = Object.keys(SPECIAL_TOKENS).length; // 10
export const SPECIAL_ENTRIES = Object.entries(SPECIAL_TOKENS) as [string, number][];

// ─── BPE Training Result ──────────────────────────────────────────────────────

export interface BPETrainResult {
  /** token string → integer ID */
  tokenToId: Record<string, number>;
  /** integer ID → token string (index array) */
  idToToken: string[];
  /** merge operations in order: "partA partB" */
  merges: string[];
  /** actual vocabulary size achieved */
  actualVocabSize: number;
}

// ─── Core BPE Training Algorithm ─────────────────────────────────────────────

/**
 * Train a BPE tokenizer on the provided corpus.
 *
 * @param corpus         Array of training strings (raw text)
 * @param targetVocabSize  Desired vocabulary size (actual may be less if corpus is small)
 * @param onProgress     Optional callback called every 500 merges
 */
export function trainBPE(
  corpus: string[],
  targetVocabSize: number,
  onProgress?: (done: number, total: number, bestFreq: number) => void,
): BPETrainResult {
  const encoder = new TextEncoder();

  // ── Step 1: Pre-tokenize corpus and count word frequencies ────────────────
  const wordFreq = new Map<string, number>(); // byteLevel string → frequency

  for (const text of corpus) {
    for (const word of pretokenize(text)) {
      const bytes = encoder.encode(word);
      const byteStr = Array.from(bytes)
        .map((b) => BYTE_ENC[b])
        .join("");
      wordFreq.set(byteStr, (wordFreq.get(byteStr) ?? 0) + 1);
    }
  }

  if (wordFreq.size === 0) {
    throw new Error("Corpus produced no pre-tokens. Provide non-empty training text.");
  }

  // ── Step 2: Initialize word token sequences (1 char = 1 byte initially) ───
  const wordTokens = new Map<string, string[]>();
  for (const [word] of wordFreq) {
    wordTokens.set(word, [...word]); // spread splits into individual Unicode chars
  }

  // ── Step 3: Base vocabulary = all 256 byte-chars (sorted for determinism) ─
  const vocabSet = new Set<string>();
  for (let b = 0; b < 256; b++) vocabSet.add(BYTE_ENC[b]);
  const sortedBaseVocab = [...vocabSet].sort();

  // ── Step 4: Determine how many merge operations to perform ────────────────
  const numMerges = Math.max(
    0,
    targetVocabSize - NUM_SPECIAL - sortedBaseVocab.length,
  );
  const merges: string[] = [];
  const mergedTokens: string[] = []; // merged tokens in merge order

  // ── Step 5: BPE merge loop ────────────────────────────────────────────────
  for (let iter = 0; iter < numMerges; iter++) {
    // Count adjacent pairs, weighted by word frequency
    const pairFreq = new Map<string, number>();

    for (const [word, freq] of wordFreq) {
      const tokens = wordTokens.get(word)!;
      for (let i = 0; i < tokens.length - 1; i++) {
        const key = tokens[i] + SEP + tokens[i + 1];
        pairFreq.set(key, (pairFreq.get(key) ?? 0) + freq);
      }
    }

    if (pairFreq.size === 0) break; // No more pairs to merge

    // Find the most frequent pair (ties broken by lexicographic order)
    let bestKey = "";
    let bestFreq = -1;
    for (const [key, freq] of pairFreq) {
      if (freq > bestFreq || (freq === bestFreq && key < bestKey)) {
        bestFreq = freq;
        bestKey = key;
      }
    }

    // Decode pair components
    const sepIdx = bestKey.indexOf(SEP);
    const a = bestKey.slice(0, sepIdx);
    const b = bestKey.slice(sepIdx + SEP.length);
    const merged = a + b;

    merges.push(`${a} ${b}`);
    mergedTokens.push(merged);

    // Progress callback every 500 iterations
    if (onProgress && iter % 500 === 0) {
      onProgress(iter, numMerges, bestFreq);
    }

    // If best pair frequency is 1, all remaining merges will also be freq=1.
    // We can stop early — these are low-value merges.
    if (bestFreq < 2 && iter > 1000) break;

    // Update word token sequences: replace every occurrence of (a, b) with merged
    for (const [word, tokens] of wordTokens) {
      if (tokens.length < 2) continue;
      let hasChanged = false;
      const newTokens: string[] = [];
      let i = 0;
      while (i < tokens.length) {
        if (
          i < tokens.length - 1 &&
          tokens[i] === a &&
          tokens[i + 1] === b
        ) {
          newTokens.push(merged);
          i += 2;
          hasChanged = true;
        } else {
          newTokens.push(tokens[i]);
          i++;
        }
      }
      if (hasChanged) wordTokens.set(word, newTokens);
    }
  }

  // ── Step 6: Build final vocabulary ────────────────────────────────────────
  const idToToken: string[] = new Array(
    NUM_SPECIAL + sortedBaseVocab.length + mergedTokens.length,
  );
  const tokenToId: Record<string, number> = {};

  // Special tokens occupy IDs 0-9
  for (const [tok, id] of SPECIAL_ENTRIES) {
    tokenToId[tok] = id;
    idToToken[id] = tok;
  }

  // Base byte-vocab occupies IDs 10..265
  let nextId = NUM_SPECIAL;
  for (const tok of sortedBaseVocab) {
    if (!(tok in tokenToId)) {
      tokenToId[tok] = nextId;
      idToToken[nextId] = tok;
      nextId++;
    }
  }

  // Merged tokens occupy IDs 266..N
  for (const tok of mergedTokens) {
    if (!(tok in tokenToId)) {
      tokenToId[tok] = nextId;
      idToToken[nextId] = tok;
      nextId++;
    }
  }

  return {
    tokenToId,
    idToToken: idToToken.slice(0, nextId),
    merges,
    actualVocabSize: nextId,
  };
}
