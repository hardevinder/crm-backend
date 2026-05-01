import type { FastifyInstance } from "fastify";
import { createManualPayment, getPayments } from "./payment.controller.js";

type CreateManualPaymentBody = {
  invoiceId: number;
  amount: number | string;
  paymentMode: string;
  paymentDate?: string;
  transactionId?: string;
  referenceNo?: string;
  remarks?: string;
};

export default async function paymentRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [app.authenticate] }, getPayments);

  app.post<{ Body: CreateManualPaymentBody }>(
    "/manual",
    { preHandler: [app.authenticate] },
    createManualPayment
  );
}
