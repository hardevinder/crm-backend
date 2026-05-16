import type { FastifyInstance } from "fastify";

import {
  createFollowUp,
  createLead,
  deleteLead,
  exportLeadsToExcel,
  getLeadById,
  getLeadDashboard,
  importLeadsFromExcel,
  listFollowUps,
  listLeads,
  updateLead,
} from "./lead.controller.js";

export default async function leadRoutes(app: FastifyInstance) {
  // Health check for SRM/CRM lead route registration
  // Final URL: GET /api/leads/ping
  app.get("/leads/ping", async () => {
    return {
      success: true,
      message: "CRM Lead routes working",
    };
  });

  // Static routes must stay before dynamic /:id routes

  // Final URL: GET /api/leads/dashboard
  app.get("/leads/dashboard", getLeadDashboard);

  // Final URL: POST /api/leads/import-excel
  // Upload field name must be: file
  app.post("/leads/import-excel", importLeadsFromExcel);

  // Final URL: GET /api/leads/export
  // Optional filters:
  // /api/leads/export?search=abc&state=Punjab&status=NEW_LEAD&hasMobile=true&hasEmail=true
  app.get("/leads/export", exportLeadsToExcel);

  // Main CRUD

  // Final URL: GET /api/leads?page=1&limit=20
  app.get("/leads", listLeads);

  // Final URL: POST /api/leads
  app.post("/leads", createLead);

  // Follow-up routes must stay before /leads/:id dynamic routes

  // Final URL: GET /api/leads/:id/followups
  app.get("/leads/:id/followups", listFollowUps);

  // Final URL: POST /api/leads/:id/followups
  app.post("/leads/:id/followups", createFollowUp);

  // Dynamic lead routes last

  // Final URL: GET /api/leads/:id
  app.get("/leads/:id", getLeadById);

  // Final URL: PATCH /api/leads/:id
  app.patch("/leads/:id", updateLead);

  // Final URL: DELETE /api/leads/:id
  app.delete("/leads/:id", deleteLead);
}