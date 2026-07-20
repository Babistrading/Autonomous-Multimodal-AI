/**
 * fineweb-loader.ts
 *
 * Loads real-world web text samples from the FineWeb dataset via the
 * Hugging Face datasets-server REST API (no auth needed for public
 * datasets), and caches them to disk so we don't re-fetch on every
 * server restart.
 *
 * Dataset: HuggingFaceFW/fineweb, config "sample-10BT" (a ~10B-token
 * random subset of the full corpus — the smallest official sample).
 *
 * Citation:
 * @misc{huggingfacefw_2024,
 *   author    = {HuggingFaceFW},
 *   title     = {fineweb (Revision af075be)},
 *   year      = 2024,
 *   url       = {https://huggingface.co/datasets/HuggingFaceFW/fineweb},
 *   doi       = {10.57967/hf/2493},
 *   publisher = {Hugging Face}
 * }
 */

import fs from "fs/promises";
import path from "path";

export const FINEWEB_CITATION = `@misc{huggingfacefw_2024,
  author    = {HuggingFaceFW},
  title     = {fineweb (Revision af075be)},
  year      = 2024,
  url       = {https://huggingface.co/datasets/HuggingFaceFW/fineweb},
  doi       = {10.57967/hf/2493},
  publisher = {Hugging Face}
}`;

const CACHE_DIR = process.env.CACHE_DIR ?? path.resolve(process.cwd(), "data", "cache");
const CACHE_FILE = "fineweb-samples.json";
const DATASET = "HuggingFaceFW/fineweb";
const CONFIG = "sample-10BT"; // smallest official random-sample config
const SPLIT = "train";
const PAGE_SIZE = 100; // max rows per request allowed by datasets-server

interface FineWebRow {
  row_idx: number;
  row: {
    text: string;
    id?: string;
    dump?: string;
    url?: string;
    date?: string;
    language?: string;
    language_score?: number;
    token_count?: number;
  };
}

interface FineWebResponse {
  rows: FineWebRow[];
  num_rows_total?: number;
}

async function ensureCacheDir(): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

async function loadCache(): Promise<string[] | null> {
  try {
    const raw = await fs.readFile(path.join(CACHE_DIR, CACHE_FILE), "utf-8");
    const parsed = JSON.parse(raw) as { samples: string[] };
    return parsed.samples;
  } catch {
    return null;
  }
}

async function saveCache(samples: string[]): Promise<void> {
  await ensureCacheDir();
  await fs.writeFile(
    path.join(CACHE_DIR, CACHE_FILE),
    JSON.stringify({ samples, cachedAt: new Date().toISOString(), citation: FINEWEB_CITATION }),
  );
}

/**
 * Splits a long web-text document into smaller, trainable chunks
 * (roughly paragraph/sentence-group sized) instead of feeding whole
 * raw documents as single training samples.
 */
function chunkText(text: string, maxChars = 600): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length === 0) return [];
  if (clean.length <= maxChars) return [clean];

  const chunks: string[] = [];
  const sentences = clean.split(/(?<=[.!?])\s+/);
  let current = "";

  for (const sentence of sentences) {
    if ((current + " " + sentence).length > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) chunks.push(current.trim());

  return chunks;
}

/**
 * Fetches `count` text samples (chunks) from FineWeb via the Hugging Face
 * datasets-server REST API. Uses a local disk cache so repeated server
 * restarts don't re-download data every time.
 */
export async function fetchFineWebSamples(count: number): Promise<string[]> {
  const cached = await loadCache();
  if (cached && cached.length >= count) {
    return cached.slice(0, count);
  }

  const collected: string[] = cached ? [...cached] : [];
  let offset = 0;

  while (collected.length < count) {
    const url =
      `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(DATASET)}` +
      `&config=${CONFIG}&split=${SPLIT}&offset=${offset}&length=${PAGE_SIZE}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`FineWeb fetch failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as FineWebResponse;
    if (!data.rows || data.rows.length === 0) break;

    for (const r of data.rows) {
      const text = r.row?.text;
      if (text && text.length > 20) {
        collected.push(...chunkText(text));
      }
    }

    offset += PAGE_SIZE;

    // Safety valve in case the API misbehaves or the dataset runs dry
    if (offset > count * 10) break;
  }

  const final = collected.slice(0, count);
  await saveCache(final);
  return final;
}
