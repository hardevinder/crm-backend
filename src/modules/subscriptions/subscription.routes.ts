import type { FastifyInstance } from "fastify";
import {
  createSubscription,
  getSubscriptions,
} from "./subscription.controller.js";

type CreateSubscriptionBody = {
  clientId: number;
  serviceName: string;
  billingCycle?: "monthly" | "quarterly" | "yearly" | "one_time";
  amount: number | string;
  gstPercent?: number | string;
  startDate?: string;
  endDate?: string;
  nextInvoiceDate?: string;
  remarks?: string;
};

export default async function subscriptionRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [app.authenticate] }, getSubscriptions);

  app.post<{ Body: CreateSubscriptionBody }>(
    "/",
    { preHandler: [app.authenticate] },
    createSubscription
  );
}
