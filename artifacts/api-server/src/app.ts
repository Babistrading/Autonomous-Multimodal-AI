import type { IncomingMessage, ServerResponse } from "http";
import { createRequire } from "node:module";
import express, { type Express, type RequestHandler } from "express";
import cors from "cors";
import type { Options as PinoHttpOptions } from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

// pino-http v10 is CJS, and under this project's TypeScript module
// resolution (node16/nodenext) a normal `import pinoHttp from "pino-http"`
// gets typed as the whole module namespace instead of the callable
// function it actually is at runtime -> TS2349 "This expression is not
// callable". Loading it through createRequire sidesteps TS's ESM/CJS
// interop elaboration entirely; we keep proper typing via the `Options`
// type import above and an explicit cast on the required value.
const require = createRequire(import.meta.url);
const pinoHttp = require("pino-http") as (opts?: PinoHttpOptions) => RequestHandler;

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: IncomingMessage & { id?: string | number }) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: ServerResponse) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api", router);

export default app;