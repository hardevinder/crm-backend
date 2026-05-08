import { FastifyInstance } from "fastify";
import {
  verifyWhatsAppWebhook,
  receiveWhatsAppWebhook,
} from "./webhook.controller";

export default async function whatsappWebhookRoutes(app: FastifyInstance) {
  app.get("/", verifyWhatsAppWebhook);
  app.post("/", receiveWhatsAppWebhook);
}