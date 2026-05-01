import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../config/prisma.js";
import path from "node:path";
import fs from "node:fs/promises";

const ADMIN_ROLES = ["superadmin", "admin", "accounts"];

function isAdminRole(role?: string) {
  return !!role && ADMIN_ROLES.includes(role);
}

async function ensureCompanySetting() {
  const existing = await prisma.companySetting.findFirst({
    orderBy: { id: "asc" },
  });

  if (existing) return existing;

  return prisma.companySetting.create({
    data: {
      companyName: "Edubridge ERP",
      legalName: "Edubridge ERP",
      brandName: "Edubridge",
      email: "support@edubridgeerp.in",
      website: "https://edubridgeerp.in",
      country: "India",
      primaryColor: "#1D4ED8",
      secondaryColor: "#0F172A",
      footerNote: "This is a system generated invoice.",
      termsAndConditions:
        "Payment is due as per invoice due date. Services may be paused for overdue invoices.",
      paymentInstructions:
        "Scan the QR code to pay. Please mention the invoice number in payment remarks.",
    },
  });
}

async function saveBrandingImage(file: any, prefix: string) {
  if (!file) {
    throw new Error("File is required");
  }

  if (!file.mimetype || !file.mimetype.startsWith("image/")) {
    throw new Error("Only image files are allowed");
  }

  const ext = path.extname(file.filename || "").toLowerCase() || ".png";
  const safeFileName = `${prefix}-${Date.now()}${ext}`;

  const uploadDir = path.join(process.cwd(), "uploads", "branding");
  await fs.mkdir(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, safeFileName);
  const buffer = await file.toBuffer();

  await fs.writeFile(filePath, buffer);

  return `/uploads/branding/${safeFileName}`;
}

export async function getCompanySettings(
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (!isAdminRole(request.user.role)) {
    return reply.code(403).send({
      success: false,
      message: "Forbidden",
    });
  }

  const setting = await ensureCompanySetting();

  return reply.send({
    success: true,
    data: setting,
  });
}

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

export async function updateCompanySettings(
  request: FastifyRequest<{ Body: UpdateCompanySettingsBody }>,
  reply: FastifyReply
) {
  if (!isAdminRole(request.user.role)) {
    return reply.code(403).send({
      success: false,
      message: "Forbidden",
    });
  }

  const current = await ensureCompanySetting();
  const body = request.body || {};

  const updated = await prisma.companySetting.update({
    where: { id: current.id },
    data: {
      companyName: body.companyName,
      legalName: body.legalName,
      brandName: body.brandName,
      gstin: body.gstin,
      pan: body.pan,
      addressLine1: body.addressLine1,
      addressLine2: body.addressLine2,
      city: body.city,
      state: body.state,
      country: body.country,
      pincode: body.pincode,
      phone: body.phone,
      email: body.email,
      website: body.website,
      bankName: body.bankName,
      bankAccountName: body.bankAccountName,
      bankAccountNumber: body.bankAccountNumber,
      ifscCode: body.ifscCode,
      upiId: body.upiId,
      bankQrImageUrl: body.bankQrImageUrl,
      paymentInstructions: body.paymentInstructions,
      primaryColor: body.primaryColor,
      secondaryColor: body.secondaryColor,
      invoicePrefix: body.invoicePrefix,
      footerNote: body.footerNote,
      termsAndConditions: body.termsAndConditions,
    },
  });

  return reply.send({
    success: true,
    message: "Company settings updated successfully",
    data: updated,
  });
}

export async function uploadCompanyLogo(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    if (!isAdminRole(request.user.role)) {
      return reply.code(403).send({
        success: false,
        message: "Forbidden",
      });
    }

    const file = await request.file();

    if (!file) {
      return reply.code(400).send({
        success: false,
        message: "Logo file is required",
      });
    }

    const logoUrl = await saveBrandingImage(file, "company-logo");
    const current = await ensureCompanySetting();

    const updated = await prisma.companySetting.update({
      where: { id: current.id },
      data: {
        logoUrl,
      },
    });

    return reply.send({
      success: true,
      message: "Company logo uploaded successfully",
      data: updated,
    });
  } catch (error: any) {
    return reply.code(400).send({
      success: false,
      message: error?.message || "Failed to upload company logo",
    });
  }
}

export async function uploadBankQrImage(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    if (!isAdminRole(request.user.role)) {
      return reply.code(403).send({
        success: false,
        message: "Forbidden",
      });
    }

    const file = await request.file();

    if (!file) {
      return reply.code(400).send({
        success: false,
        message: "Bank QR image file is required",
      });
    }

    const bankQrImageUrl = await saveBrandingImage(file, "bank-qr");
    const current = await ensureCompanySetting();

    const updated = await prisma.companySetting.update({
      where: { id: current.id },
      data: {
        bankQrImageUrl,
      },
    });

    return reply.send({
      success: true,
      message: "Bank QR image uploaded successfully",
      data: updated,
    });
  } catch (error: any) {
    return reply.code(400).send({
      success: false,
      message: error?.message || "Failed to upload bank QR image",
    });
  }
}