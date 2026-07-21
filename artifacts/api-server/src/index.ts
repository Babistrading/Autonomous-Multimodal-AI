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
// 1. uncaughtException / unhandledRejection — keeps process alive on any throw
// 2. _keepAlive setInterval — prevents Node.js from exiting when event loop empties
// 3. _watchdog setInterval — detects a stalled training loop and restarts it

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception — server continues running");
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled rejection — server continues running");
});

// Heartbeat: keeps the event loop non-empty so Node.js never exits on its own.
const _keepAlive = setInterval(() => {
  // Silent no-op — just holds the process open.
}, 5_000);

// Watchdog: if the training loop has produced no new step for 20 seconds while
// the engine believes it is running, kick it back to life.
let _watchdogLastStep = 0;
const _watchdog = setInterval(() => {
  try {
    const status = trainingEngine.getStatus();
    if (status.status !== "running") return;

    const now = Date.now();
    const lastStep = trainingEngine.getLastStepTime();
    const currentStep = status.step;

    // Stall detected: step count hasn't changed AND last step was >20 s ago
    if (currentStep === _watchdogLastStep && lastStep > 0 && now - lastStep > 20_000) {
      logger.warn({ step: currentStep, idleSec: Math.floor((now - lastStep) / 1000) },
        "Watchdog: training stall detected — kicking loop");
      trainingEngine.kickLoop();
    }
    _watchdogLastStep = currentStep;
  } catch { /* watchdog must never crash */ }
}, 10_000);

// ─── Graceful shutdown ────────────────────────────────────────────────────────

const shutdown = async (signal: string) => {
  logger.info({ signal }, "Shutdown signal received — saving checkpoint then exiting");
  clearInterval(_keepAlive);
  clearInterval(_watchdog);
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
    //    The loop is self-healing: if it exits unexpectedly it restarts itself.
    await trainingEngine.start("max");
    logger.info("✓ Training loop active — Babis M1 is learning 24/7");

  } catch (err) {
    const retryDelaySec = Math.min(30 * attempt, 120); // cap at 2 min
    logger.error({ err, attempt, retryDelaySec }, "Training boot failed — retrying");
    setTimeout(() => void bootTraining(attempt + 1), retryDelaySec * 1_000);
  }
}
