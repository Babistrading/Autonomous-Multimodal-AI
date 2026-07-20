/**
 * Babis M1 — API Server Entry Point
 *
 * Responsibilities:
 * - Start the HTTP server
 * - Auto-initialize the training engine (BPE tokenizer, DB seed)
 * - Launch the 24/7 continuous training loop immediately, without user interaction
 * - Keep the Node.js process alive at all times (even between training steps or requests)
 * - Recover from crashes without taking the server down
 */

import app from "./app.js";
import { logger } from "./lib/logger.js";
import { trainingEngine } from "./lib/training/engine.js";

// ─── Port validation ──────────────────────────────────────────────────────────

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required.");

const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

// ─── Process stability ────────────────────────────────────────────────────────
//
// These three guards ensure the server stays up 24/7:
//
// 1. uncaughtException — catches synchronous throws that escape all try/catch
// 2. unhandledRejection — catches async Promise rejections with no handler
// 3. setInterval keep-alive — prevents Node.js from exiting when the event loop
//    runs dry (e.g., between training steps with no pending I/O)

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception — server continues running");
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled rejection — server continues running");
});

// Heartbeat: keeps the event loop non-empty so Node.js never exits on its own.
const _keepAlive = setInterval(() => {
  // Silent no-op — just holds the process open.
}, 10_000);

// ─── Graceful shutdown ────────────────────────────────────────────────────────

const shutdown = async (signal: string) => {
  logger.info({ signal }, "Shutdown signal received — saving checkpoint then exiting");
  clearInterval(_keepAlive);
  try {
    await trainingEngine.emergencySave();
  } catch (err) {
    logger.warn({ err }, "Checkpoint save failed during shutdown");
  }
  process.exit(0);
};
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT",  () => void shutdown("SIGINT"));

// ─── HTTP server + 24/7 training ─────────────────────────────────────────────

app.listen(port, () => {
  logger.info({ port }, "Server listening — starting 24/7 training loop");

  // Start training asynchronously; errors are caught and trigger an auto-retry.
  void bootTraining();
});

/**
 * Initialize the training engine and launch the continuous training loop.
 * On failure, waits 30 s then retries automatically — the server never gives up.
 */
async function bootTraining(attempt = 1): Promise<void> {
  try {
    logger.info({ attempt }, "Booting Babis M1 training engine");

    // 1. Initialize: trains BPE tokenizer on first run (persisted afterward),
    //    seeds the PostgreSQL database with workers/datasets/agents.
    await trainingEngine.initialize();
    logger.info("Training engine initialized — BPE tokenizer ready, DB seeded");

    // 2. Start the continuous training loop.
    //    The engine's internal setImmediate loop runs forever, yielding between
    //    steps so the event loop (and HTTP requests) stay responsive.
    await trainingEngine.start("medium");
    logger.info("✓ Training loop active — Babis M1 is learning 24/7");

  } catch (err) {
    const retryDelaySec = Math.min(30 * attempt, 120); // cap at 2 min
    logger.error({ err, attempt, retryDelaySec }, "Training boot failed — retrying");
    setTimeout(() => void bootTraining(attempt + 1), retryDelaySec * 1_000);
  }
}
