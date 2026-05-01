import type { FastifyInstance } from "fastify";
import {
  getCompanySettings,
  updateCompanySettings,
  uploadBankQrImage,
  uploadCompanyLogo,
} from "./companySettings.controller.js";

type UpdateCompanySettingsBody = {
  companyName?: string;
  legalName?: string;
  brandName?: string;
  gstin?: string;
  pan?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  website?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  ifscCode?: string;
  upiId?: string;
  bankQrImageUrl?: string;
  paymentInstructions?: string;
  primaryColor?: string;
  secondaryColor?: string;
  invoicePrefix?: string;
  footerNote?: string;
  termsAndConditions?: string;
};

export default async function companySettingsRoutes(app: FastifyInstance) {
  app.get(
    "/company",
    { preHandler: [app.authenticate] },
    getCompanySettings
  );

  app.put<{ Body: UpdateCompanySettingsBody }>(
    "/company",
    { preHandler: [app.authenticate] },
    updateCompanySettings
  );

  app.post(
    "/company/logo",
    { preHandler: [app.authenticate] },
    uploadCompanyLogo
  );

  app.post(
    "/company/bank-qr",
    { preHandler: [app.authenticate] },
    uploadBankQrImage
  );
}