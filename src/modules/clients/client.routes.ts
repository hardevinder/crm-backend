import type { FastifyInstance } from "fastify";
import {
  createClient,
  deleteClient,
  getClientById,
  getClients,
  updateClient,
} from "./client.controller.js";

type ClientParams = {
  id: string;
};

type ClientType =
  | "school"
  | "college"
  | "transport"
  | "website"
  | "software"
  | "result_analyzer"
  | "other";

type CreateClientBody = {
  clientName: string;
  clientCode: string;
  clientType?: ClientType;
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

type UpdateClientBody = {
  clientName?: string;
  clientCode?: string;
  clientType?: ClientType;
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

  app.get<{ Params: ClientParams }>(
    "/:id",
    { preHandler: [app.authenticate] },
    getClientById
  );

  app.post<{ Body: CreateClientBody }>(
    "/",
    { preHandler: [app.authenticate] },
    createClient
  );

  app.put<{ Params: ClientParams; Body: UpdateClientBody }>(
    "/:id",
    { preHandler: [app.authenticate] },
    updateClient
  );

  app.delete<{ Params: ClientParams }>(
    "/:id",
    { preHandler: [app.authenticate] },
    deleteClient
  );
}