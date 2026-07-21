---
name: Worker chunk tracking fix
description: All workers showed the same FineWeb line range because runOneStep() used the global cursor instead of per-worker bounds.
---

In `engine.ts` `runOneStep()`, the old code did:
```js
const cursor = this.cursor.getGlobalCursor();
worker.chunkStart = Math.max(0, cursor - 100);
worker.chunkEnd = cursor;
```
This stamped every worker with the same global cursor position.

**Fix:** Added `chunkStart`/`chunkEnd` fields to `WorkerChunkState` in `dataset.ts` and a `getWorkerBounds(workerId)` method. In `runOneStep()`, use:
```js
const bounds = this.cursor.getWorkerBounds(worker.id);
worker.chunkStart = bounds.start;
worker.chunkEnd = bounds.end;
```

**Why:** The global cursor is shared and advances after every `getNextSample()` call across all workers. Each worker's actual assigned chunk is tracked separately in `workerState` map.
