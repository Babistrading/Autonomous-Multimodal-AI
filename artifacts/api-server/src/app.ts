import type { IncomingMessage, ServerResponse } from "http";
import express, { type Express } from "express";
import cors from "cors";
import * as pinoHttpModule from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

// pino-http v10 ships as CJS. Under TypeScript's "node16"/"nodenext"
// moduleResolution, `import pinoHttp from "pino-http"` gets typed as a
// namespace instead of the callable function it is at runtime, which is
// what caused TS2349 ("This expression is not callable"). Grabbing the
// default export explicitly (with a runtime fallback) fixes the typing
// without changing behavior.
const pinoHttp = (pinoHttpModule as unknown as { default: typeof pinoHttpModule.default }).default
  ?? (pinoHttpModule as unknown as typeof pinoHttpModule.default);

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