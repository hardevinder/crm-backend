import type { FastifyInstance } from "fastify";

import {
  createWhatsappCampaign,
  createWhatsappTemplate,
  getWhatsappCampaign,
  listWhatsappCampaignRecipients,
  listWhatsappCampaigns,
  listWhatsappTemplates,
  prepareWhatsappCampaignRecipients,
  sendManualWhatsappReply,
  sendTemplateToSingleLead,
  sendWhatsappCampaign,
  syncWhatsappTemplates,
  updateWhatsappCampaign,
} from "./whatsapp-campaign.controller.js";

export default async function whatsappCampaignRoutes(app: FastifyInstance) {
  // Templates
  app.get("/templates", listWhatsappTemplates);
  app.post("/templates", createWhatsappTemplate);
  app.post("/templates/sync", syncWhatsappTemplates);

  // Campaigns
  app.get("/campaigns", listWhatsappCampaigns);
  app.post("/campaigns", createWhatsappCampaign);
  app.get("/campaigns/:id", getWhatsappCampaign);
  app.patch("/campaigns/:id", updateWhatsappCampaign);

  // Campaign recipients
  app.post(
    "/campaigns/:id/prepare-recipients",
    prepareWhatsappCampaignRecipients
  );

  app.get(
    "/campaigns/:id/recipients",
    listWhatsappCampaignRecipients
  );

  app.post("/campaigns/:id/send", sendWhatsappCampaign);

  // Single lead template message
  app.post("/send-template", sendTemplateToSingleLead);

  // Manual WhatsApp reply
  app.post("/manual-reply", sendManualWhatsappReply);
}