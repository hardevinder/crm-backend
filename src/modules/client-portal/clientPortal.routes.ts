import type { FastifyInstance } from "fastify";
import { getMyProfile } from "./clientPortal.controller.js";
import { getClientPortalInvoices } from "../invoices/invoice.controller.js";
import { getClientPortalPayments } from "../payments/payment.controller.js";

export default async function clientPortalRoutes(app: FastifyInstance) {
  app.get("/me", { preHandler: [app.authenticate] }, getMyProfile);
  app.get("/invoices", { preHandler: [app.authenticate] }, getClientPortalInvoices);
  app.get("/payments", { preHandler: [app.authenticate] }, getClientPortalPayments);
}
