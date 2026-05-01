import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../config/prisma.js";
import puppeteer from "puppeteer";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { renderInvoicePdfHtml } from "./invoicePdf.template.js";
import { env } from "../../config/env.js";

const ADMIN_ROLES = ["superadmin", "admin", "accounts"] as const;

type InvoiceParams = {
  id: string;
};

type PublicInvoiceParams = {
  token: string;
};

type ShareLinkBody = {
  expiresInDays?: number;
};

function isAdminRole(role?: string) {
  return !!role && ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number]);
}

function normalizeString(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function getMimeType(filePathOrUrl: string, contentType?: string | null) {
  if (contentType) {
    if (contentType.includes("jpeg")) return "image/jpeg";
    if (contentType.includes("jpg")) return "image/jpeg";
    if (contentType.includes("webp")) return "image/webp";
    if (contentType.includes("svg")) return "image/svg+xml";
    if (contentType.includes("png")) return "image/png";
  }

  const ext = path.extname(filePathOrUrl).toLowerCase();

  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";

  return "image/png";
}

function getInvoiceFileName(invoiceNo?: string | null) {
  const raw = normalizeString(invoiceNo, "invoice");
  const safe = raw.replace(/[^\w.-]+/g, "-");
  return `${safe}.pdf`;
}

function normalizeBaseUrl(url?: string | null) {
  return normalizeString(url).replace(/\/+$/, "");
}

function buildShareUrl(token: string) {
  const baseUrl = normalizeBaseUrl(env.API_URL || env.APP_URL);
  return `${baseUrl}/api/crm/invoices/share/${token}/pdf`;
}

async function getCompanySetting() {
  const setting = await prisma.companySetting.findFirst({
    orderBy: { id: "asc" },
  });

  if (setting) return setting;

  return prisma.companySetting.create({
    data: {
      companyName: "EduBridge ERP",
      legalName: "EduBridge ERP",
      brandName: "EduBridge",
      email: "info@edubridgeerp.in",
      website: "https://edubridgeerp.in",
      country: "India",
      primaryColor: "#1D4ED8",
      secondaryColor: "#0F172A",
      footerNote: "This is a system generated invoice.",
      termsAndConditions:
        "Payment is due as per invoice due date. Please mention invoice number while making payment.",
      paymentInstructions:
        "Scan the QR code to pay. Please mention invoice number in payment remarks.",
    },
  });
}

function prepareCompanyForInvoice(company: any) {
  return {
    ...company,
    companyName: normalizeString(company?.companyName, "Edubridge ERP"),
    legalName: normalizeString(company?.legalName, company?.companyName || "Edubridge ERP"),
    brandName: normalizeString(company?.brandName, company?.companyName || "Edubridge ERP"),
    gstin: normalizeString(company?.gstin),
    pan: normalizeString(company?.pan),
    addressLine1: normalizeString(company?.addressLine1),
    addressLine2: normalizeString(company?.addressLine2),
    city: normalizeString(company?.city),
    state: normalizeString(company?.state),
    country: normalizeString(company?.country, "India"),
    pincode: normalizeString(company?.pincode),
    phone: normalizeString(company?.phone),
    email: normalizeString(company?.email),
    website: normalizeString(company?.website),
    bankName: normalizeString(company?.bankName),
    bankAccountName: normalizeString(company?.bankAccountName),
    bankAccountNumber: normalizeString(company?.bankAccountNumber),
    ifscCode: normalizeString(company?.ifscCode),
    upiId: normalizeString(company?.upiId),
    bankQrImageUrl: normalizeString(company?.bankQrImageUrl),
    logoUrl: normalizeString(company?.logoUrl),
    paymentInstructions: normalizeString(
      company?.paymentInstructions,
      "Scan the QR code to pay. Please mention invoice number in payment remarks."
    ),
    primaryColor: normalizeString(company?.primaryColor, "#1D4ED8"),
    secondaryColor: normalizeString(company?.secondaryColor, "#0F172A"),
    invoicePrefix: normalizeString(company?.invoicePrefix, "EB-INV"),
    footerNote: normalizeString(
      company?.footerNote,
      "This is a system generated invoice."
    ),
    termsAndConditions: normalizeString(
      company?.termsAndConditions,
      "Payment is due as per invoice due date. Please mention invoice number while making payment."
    ),
  };
}

async function getRemoteFileDataUri(fileUrl: string) {
  try {
    const response = await fetch(fileUrl);

    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = getMimeType(
      fileUrl,
      response.headers.get("content-type")
    );

    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

async function getLocalFileDataUri(fileUrl: string) {
  const relativePath = fileUrl.replace(/^\/+/, "");
  const fullPath = path.join(process.cwd(), relativePath);

  try {
    const buffer = await fs.readFile(fullPath);
    const mimeType = getMimeType(fullPath);
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

async function getFileDataUri(fileUrl?: string | null) {
  if (!fileUrl) return null;

  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
    return await getRemoteFileDataUri(fileUrl);
  }

  return await getLocalFileDataUri(fileUrl);
}

async function getInvoiceById(invoiceId: number) {
  return prisma.clientInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      client: true,
      subscription: true,
      payments: {
        orderBy: { paymentDate: "asc" },
      },
    },
  });
}

async function getInvoiceByShareToken(token: string) {
  return prisma.clientInvoice.findFirst({
    where: {
      shareToken: token,
      shareEnabled: true,
    },
    include: {
      client: true,
      subscription: true,
      payments: {
        orderBy: { paymentDate: "asc" },
      },
    },
  });
}

async function createInvoicePdfBuffer(invoice: any) {
  const companyRecord = await getCompanySetting();
  const company = prepareCompanyForInvoice(companyRecord);

  const logoDataUri = await getFileDataUri(company.logoUrl);
  const bankQrDataUri = await getFileDataUri(company.bankQrImageUrl);

  const html = renderInvoicePdfHtml({
    invoice,
    company,
    logoDataUri,
    bankQrDataUri,
  });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    await page.setViewport({
      width: 1440,
      height: 2200,
      deviceScaleFactor: 1,
    });

    await page.emulateMediaType("screen");

    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "18px",
        right: "18px",
        bottom: "18px",
        left: "18px",
      },
    });
  } finally {
    await browser.close();
  }
}

export async function downloadInvoicePdf(
  request: FastifyRequest<{ Params: InvoiceParams }>,
  reply: FastifyReply
) {
  const invoiceId = Number(request.params.id);

  if (!invoiceId || Number.isNaN(invoiceId)) {
    return reply.code(400).send({
      success: false,
      message: "Valid invoice id is required",
    });
  }

  const invoice = await getInvoiceById(invoiceId);

  if (!invoice) {
    return reply.code(404).send({
      success: false,
      message: "Invoice not found",
    });
  }

  const isAdmin = isAdminRole(request.user.role);
  const isSameClient =
    request.user.clientId != null &&
    Number(request.user.clientId) === Number(invoice.clientId);

  if (!isAdmin && !isSameClient) {
    return reply.code(403).send({
      success: false,
      message: "Forbidden",
    });
  }

  const pdfBuffer = await createInvoicePdfBuffer(invoice);
  const fileName = getInvoiceFileName(invoice.invoiceNo);

  return reply
    .header("Content-Type", "application/pdf")
    .header("Content-Disposition", `inline; filename="${fileName}"`)
    .send(pdfBuffer);
}

export async function createInvoiceShareLink(
  request: FastifyRequest<{ Params: InvoiceParams; Body: ShareLinkBody }>,
  reply: FastifyReply
) {
  if (!isAdminRole(request.user.role)) {
    return reply.code(403).send({
      success: false,
      message: "Forbidden",
    });
  }

  const invoiceId = Number(request.params.id);

  if (!invoiceId || Number.isNaN(invoiceId)) {
    return reply.code(400).send({
      success: false,
      message: "Valid invoice id is required",
    });
  }

  const invoice = await prisma.clientInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      client: true,
    },
  });

  if (!invoice) {
    return reply.code(404).send({
      success: false,
      message: "Invoice not found",
    });
  }

  if (!["paid", "partial"].includes(String(invoice.status))) {
    return reply.code(400).send({
      success: false,
      message: "Only paid or partial invoices can be shared",
    });
  }

  const expiresInDays = Math.max(1, Number(request.body?.expiresInDays || 30));
  const shareToken = crypto.randomBytes(32).toString("hex");

  const shareExpiresAt = new Date();
  shareExpiresAt.setDate(shareExpiresAt.getDate() + expiresInDays);

  const updated = await prisma.clientInvoice.update({
    where: { id: invoice.id },
    data: {
      shareToken,
      shareEnabled: true,
      shareExpiresAt,
      sharedAt: new Date(),
    },
  });

  return reply.send({
    success: true,
    message: "Invoice share link created successfully",
    data: {
      invoiceId: updated.id,
      invoiceNo: updated.invoiceNo,
      status: updated.status,
      shareUrl: buildShareUrl(shareToken),
      shareExpiresAt: updated.shareExpiresAt,
    },
  });
}

export async function publicDownloadInvoicePdf(
  request: FastifyRequest<{ Params: PublicInvoiceParams }>,
  reply: FastifyReply
) {
  const token = normalizeString(request.params.token);

  if (!token) {
    return reply.code(400).send({
      success: false,
      message: "Share token is required",
    });
  }

  const invoice = await getInvoiceByShareToken(token);

  if (!invoice) {
    return reply.code(404).send({
      success: false,
      message: "Shared invoice not found or link disabled",
    });
  }

  if (invoice.shareExpiresAt && invoice.shareExpiresAt < new Date()) {
    return reply.code(410).send({
      success: false,
      message: "Invoice share link has expired",
    });
  }

  const pdfBuffer = await createInvoicePdfBuffer(invoice);
  const fileName = getInvoiceFileName(invoice.invoiceNo);

  return reply
    .header("Content-Type", "application/pdf")
    .header("Content-Disposition", `inline; filename="${fileName}"`)
    .send(pdfBuffer);
}