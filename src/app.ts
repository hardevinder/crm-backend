import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import staticPlugin from "@fastify/static";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { env } from "./config/env.js";
import jwtPlugin from "./plugins/jwt.js";
import routes from "./routes/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function normalizeOrigin(origin?: string | null) {
  return String(origin || "").trim().replace(/\/+$/, "");
}

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  const allowedOrigins = [
    normalizeOrigin(env.APP_URL),
    "http://localhost:5173",
  ].filter(Boolean);

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }

      const normalizedOrigin = normalizeOrigin(origin);

      if (allowedOrigins.includes(normalizedOrigin)) {
        cb(null, true);
        return;
      }

      cb(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  });

  await app.register(multipart);

  await app.register(staticPlugin, {
    root: path.join(__dirname, "../uploads"),
    prefix: "/uploads/",
  });

  await app.register(jwtPlugin);

  await app.register(routes, {
    prefix: "/api",
  });

  app.get("/health", async () => {
    return {
      success: true,
      message: "Edubridge CRM API running",
    };
  });

  return app;
}