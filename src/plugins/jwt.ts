import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      id: number;
      email: string;
      role: string;
      clientId?: number | null;
    };
    user: {
      id: number;
      email: string;
      role: string;
      clientId?: number | null;
    };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(async (app) => {
  await app.register(jwt, {
    secret: env.JWT_SECRET,
  });

  app.decorate(
    "authenticate",
    async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        await request.jwtVerify();
      } catch {
        return reply.code(401).send({
          success: false,
          message: "Unauthorized",
        });
      }
    }
  );
});
