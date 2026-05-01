import type { FastifyInstance } from "fastify";
import { createClient, getClients } from "./client.controller.js";

type CreateClientBody = {
  clientName: string;
  clientCode: string;
  clientType?: "school" | "college" | "transport" | "website" | "software" | "result_analyzer" | "other";
  contactPerson?: string;
  phone?: string;
  email?: string;
  businessName?: string;
  gstin?: string;
  address?: string;
  city?: string;
  state?: string;
  websiteUrl?: string;
  projectUrl?: string;
  notes?: string;
};

export default async function clientRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [app.authenticate] }, getClients);

  app.post<{ Body: CreateClientBody }>(
    "/",
    { preHandler: [app.authenticate] },
    createClient
  );
}
