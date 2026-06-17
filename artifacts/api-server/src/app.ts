import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { createSessionMiddleware } from "./lib/session";
import { csrfOriginGuard } from "./lib/csrf";

const app: Express = express();

// Behind the Replit reverse proxy: trust it so secure cookies and req.secure
// reflect the original (TLS-terminated) request.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(createSessionMiddleware());

// CSRF defense for cookie-auth mutations (the session cookie is SameSite=None
// for the cross-site preview iframe, so the browser's implicit protection is
// gone). Must run after the session middleware and before the routes.
app.use("/api", csrfOriginGuard);
app.use("/api", router);

export default app;
