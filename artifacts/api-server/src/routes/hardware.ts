import { Router, type IRouter } from "express";
import os from "os";

const router: IRouter = Router();

// CPU usage tracking — compare two snapshots
let prevCpuTimes = getCpuTimes();
let prevCpuTimestamp = Date.now();
let cachedCpuPercent = 0;

function getCpuTimes(): { idle: number; total: number } {
  const cpus = os.cpus();
  let idle = 0, total = 0;
  for (const cpu of cpus) {
    idle += cpu.times.idle;
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
  }
  return { idle, total };
}

// Update CPU usage every 2 seconds
setInterval(() => {
  const curr = getCpuTimes();
  const idleDiff = curr.idle - prevCpuTimes.idle;
  const totalDiff = curr.total - prevCpuTimes.total;
  cachedCpuPercent = totalDiff > 0 ? Math.round((1 - idleDiff / totalDiff) * 100) : 0;
  prevCpuTimes = curr;
  prevCpuTimestamp = Date.now();
}, 2000);

function recommendPowerMode(totalRamMb: number, cpuCount: number): string {
  if (totalRamMb < 512 || cpuCount <= 1) return "low";
  if (totalRamMb < 2048 || cpuCount <= 2) return "medium";
  if (totalRamMb < 4096 || cpuCount <= 4) return "high";
  return "max";
}

// GET /hardware/metrics
router.get("/hardware/metrics", async (_req, res): Promise<void> => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const cpuCount = os.cpus().length;
  const totalMemMb = totalMem / (1024 * 1024);
  const usedMemMb = usedMem / (1024 * 1024);

  // Estimate disk (Replit default ~10GB)
  const storageTotalMb = 10240;
  const storageFreeMb = Math.max(0, storageTotalMb - Math.round(process.memoryUsage().rss / (1024 * 1024) * 10));

  res.json({
    cpuUsagePercent: cachedCpuPercent,
    ramUsedMb: Math.round(usedMemMb),
    ramTotalMb: Math.round(totalMemMb),
    gpuAvailable: false,
    gpuUsagePercent: null,
    gpuVramUsedMb: null,
    storageFreeMb,
    storageTotalMb,
    uptimeSeconds: Math.floor(os.uptime()),
    recommendedPowerMode: recommendPowerMode(totalMemMb, cpuCount),
  });
});

export default router;
