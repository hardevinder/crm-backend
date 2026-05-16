import type { FastifyInstance } from "fastify";

import {
  receiveWhatsAppWebhook,
  verifyWhatsAppWebhook,
} from "./webhook.controller.js";

export default async function whatsappWebhookRoutes(app: FastifyInstance) {
  app.get("/", verifyWhatsAppWebhook);
  app.post("/", receiveWhatsAppWebhook);
}
