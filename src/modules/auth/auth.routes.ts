import type { FastifyInstance } from "fastify";
import { login } from "./auth.controller.js";

export default async function authRoutes(app: FastifyInstance) {
  app.post("/login", login);
}
