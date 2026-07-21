# Babis M1 — Autonomous Multimodal AI Platform

A full-stack AI platform with a training dashboard, chat interface, model management, dataset tools, and real-time monitoring.

## Run & Operate

Workflows are configured and managed by Replit — restart them from the workflow panel if needed.

- **API Server** (`artifacts/api-server`): `pnpm --filter @workspace/api-server run dev` (builds with esbuild, then starts Node)
- **Web UI** (`artifacts/babis-m1`): `pnpm --filter @workspace/babis-m1 run dev` (Vite dev server)
- `pnpm install` — install/link all workspace dependencies (run from root)
- `pnpm --filter @workspace/db run push` — push Drizzle schema changes to the dev database
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `DATABASE_URL` is managed automatically by Replit — no manual setup needed

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/src/` — Express API, routes, training engine, BPE tokenizer, math kernels
- `artifacts/babis-m1/src/` — React frontend (chat, training dashboard, workers, datasets, agents, model)
- `lib/db/src/schema/` — Drizzle ORM schema (source of truth for DB tables)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `lib/api-client-react/` — generated React hooks (from Orval codegen)
- `lib/api-zod/` — generated Zod validators (from Orval codegen)
- `artifacts/api-server/data/checkpoints/` — persisted model weight files
- `artifacts/api-server/data/tokenizer/` — persisted BPE vocab

## Architecture decisions

- Training runs as a self-healing 24/7 loop inside the API server process; a watchdog restarts stalled loops automatically.
- The API server requires `deploymentTarget = "vm"` for continuous training — autoscale would kill the loop on scale-to-zero.
- BPE tokenizer is trained once on first boot and persisted to disk; subsequent boots load it in milliseconds.
- The 40M-param transformer uses vanilla Float32Array math (no GPU/WASM acceleration); this keeps the code portable but caps training speed.
- API codegen (Orval) generates both fetch clients and Zod validators from a single OpenAPI spec — edit the spec, not the generated files.

## Product

Babis M1 is an autonomous AI training platform. It continuously trains a 40M-parameter LLaMA-2 inspired transformer on FineWeb web text, 24/7. Users can chat with the model as it trains, monitor loss curves and training metrics on the dashboard, inspect datasets and workers, manage agents, and view checkpoint history.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
