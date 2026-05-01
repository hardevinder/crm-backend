import type { FastifyInstance } from "fastify";
import authRoutes from "../modules/auth/auth.routes.js";
import clientRoutes from "../modules/clients/client.routes.js";
import clientPortalRoutes from "../modules/client-portal/clientPortal.routes.js";
import subscriptionRoutes from "../modules/subscriptions/subscription.routes.js";
import invoiceRoutes from "../modules/invoices/invoice.routes.js";
import companySettingsRoutes from "../modules/settings/companySettings.routes.js";
import paymentRoutes from "../modules/payments/payment.routes.js";

export default async function routes(app: FastifyInstance) {
  app.register(authRoutes, { prefix: "/auth" });
  app.register(clientRoutes, { prefix: "/crm/clients" });
  app.register(subscriptionRoutes, { prefix: "/crm/subscriptions" });
  app.register(invoiceRoutes, { prefix: "/crm/invoices" });
  app.register(paymentRoutes, { prefix: "/crm/payments" });
  app.register(companySettingsRoutes, { prefix: "/crm/settings" });
  app.register(clientPortalRoutes, { prefix: "/client-portal" });
}
