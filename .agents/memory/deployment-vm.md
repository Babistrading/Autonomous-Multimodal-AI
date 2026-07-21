---
name: Deployment target must be VM
description: Training loop dies on autoscale because Replit scales to zero with no traffic; must use vm for 24/7 operation.
---

The API server runs a continuous training loop (no external requests needed). `autoscale` kills it after ~20 steps of idle — no incoming traffic means the container sleeps.

**Why:** Autoscale deployment targets scale to zero when there are no HTTP requests. The training loop only needs the process to stay alive, not HTTP traffic.

**How to apply:** `.replit` must have `deploymentTarget = "vm"` (not `"autoscale"`) for any project with a long-running background process. Change via `verifyAndReplaceDotReplit`.
