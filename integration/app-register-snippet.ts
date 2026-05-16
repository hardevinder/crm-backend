// Add these imports in src/app.ts
import whatsappCampaignRoutes from "./modules/whatsapp-campaign/whatsapp-campaign.routes.js";
import whatsappWebhookRoutes from "./modules/whatsapp-webhook/webhook.routes.js";

// Add these route registrations in src/app.ts after app/plugin setup.
// Keep webhook WITHOUT /api because your Meta callback URL is:
// https://api-crm.edubridgeerp.in/webhooks/whatsapp
app.register(whatsappWebhookRoutes, {
  prefix: "/webhooks/whatsapp",
});

// Admin/API routes for campaigns.
app.register(whatsappCampaignRoutes, {
  prefix: "/api/whatsapp",
});
