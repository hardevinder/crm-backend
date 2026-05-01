import type { FastifyInstance } from "fastify";
import { generateInvoice, getInvoices } from "./invoice.controller.js";
import {
  createInvoiceShareLink,
  downloadInvoicePdf,
  publicDownloadInvoicePdf,
} from "./invoicePdf.controller.js";

type GenerateInvoiceBody = {
  subscriptionId: number;
  invoiceDate?: string;
  dueDate?: string;
  billingPeriodFrom?: string;
  billingPeriodTo?: string;
  notes?: string;
};

type ShareLinkBody = {
  expiresInDays?: number;
};

export default async function invoiceRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [app.authenticate] }, getInvoices);

  app.get<{ Params: { token: string } }>("/share/:token/pdf", publicDownloadInvoicePdf);

  app.get<{ Params: { id: string } }>(
    "/:id/pdf",
    { preHandler: [app.authenticate] },
    downloadInvoicePdf
  );

  app.post<{ Params: { id: string }; Body: ShareLinkBody }>(
    "/:id/share-link",
    { preHandler: [app.authenticate] },
    createInvoiceShareLink
  );

  app.post<{ Body: GenerateInvoiceBody }>(
    "/generate",
    { preHandler: [app.authenticate] },
    generateInvoice
  );
}
