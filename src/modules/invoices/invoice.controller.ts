import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../config/prisma.js";

const ADMIN_ROLES = ["superadmin", "admin", "accounts"];

function isAdminRole(role?: string) {
  return !!role && ADMIN_ROLES.includes(role);
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addBillingCycle(date: Date, cycle: string) {
  const d = new Date(date);

  if (cycle === "monthly") d.setMonth(d.getMonth() + 1);
  else if (cycle === "quarterly") d.setMonth(d.getMonth() + 3);
  else if (cycle === "yearly") d.setFullYear(d.getFullYear() + 1);
  else return null;

  return d;
}

function toDate(value?: string | null) {
  return value ? new Date(value) : undefined;
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as any).code === "P2002"
  );
}

/**
 * Generates next invoice number like:
 * EB-INV-2026-00001
 * EB-INV-2026-00002
 *
 * Important:
 * Do NOT use count + 1 here.
 * Count can create duplicate numbers if an invoice was deleted,
 * skipped, or two requests run at the same time.
 */
async function generateInvoiceNo(invoiceDate: Date) {
  const year = invoiceDate.getFullYear();
  const prefix = `EB-INV-${year}-`;

  const lastInvoice = await prisma.clientInvoice.findFirst({
    where: {
      invoiceNo: {
        startsWith: prefix,
      },
    },
    orderBy: {
      invoiceNo: "desc",
    },
    select: {
      invoiceNo: true,
    },
  });

  let nextNumber = 1;

  if (lastInvoice?.invoiceNo) {
    const lastPart = lastInvoice.invoiceNo.split("-").pop();
    const lastNumber = Number(lastPart);

    if (!Number.isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  return `${prefix}${String(nextNumber).padStart(5, "0")}`;
}

type GenerateInvoiceBody = {
  subscriptionId: number;
  invoiceDate?: string;
  dueDate?: string;
  billingPeriodFrom?: string;
  billingPeriodTo?: string;
  notes?: string;
};

type InvoiceCreateData = {
  clientId: number;
  subscriptionId: number;
  invoiceDate: Date;
  dueDate: Date;
  billingPeriodFrom?: Date;
  billingPeriodTo?: Date;
  subtotal: string;
  gstPercent: string;
  gstAmount: string;
  totalAmount: string;
  paidAmount: string;
  balanceAmount: string;
  status: "unpaid" | "paid" | "partially_paid" | "cancelled" | "overdue";
  notes?: string;
};

async function createInvoiceWithUniqueNo(
  data: InvoiceCreateData,
  invoiceDate: Date
) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 5; attempt++) {
    const invoiceNo = await generateInvoiceNo(invoiceDate);

    try {
      return await prisma.clientInvoice.create({
        data: {
          ...data,
          invoiceNo,
        },
        include: {
          client: true,
          subscription: true,
        },
      });
    } catch (error) {
      lastError = error;

      // If another request created same invoiceNo at same time,
      // retry and generate next invoiceNo again.
      if (isUniqueConstraintError(error)) {
        continue;
      }

      throw error;
    }
  }

  console.error("Unable to generate unique invoice number", lastError);

  throw new Error(
    "Unable to generate unique invoice number. Please try again."
  );
}

export async function generateInvoice(
  request: FastifyRequest<{ Body: GenerateInvoiceBody }>,
  reply: FastifyReply
) {
  try {
    if (!isAdminRole(request.user.role)) {
      return reply.code(403).send({ success: false, message: "Forbidden" });
    }

    const body = request.body || {};

    if (!body.subscriptionId) {
      return reply.code(400).send({
        success: false,
        message: "subscriptionId is required",
      });
    }

    const subscription = await prisma.clientSubscription.findUnique({
      where: { id: Number(body.subscriptionId) },
      include: { client: true },
    });

    if (!subscription) {
      return reply.code(404).send({
        success: false,
        message: "Subscription not found",
      });
    }

    if (subscription.status !== "active") {
      return reply.code(400).send({
        success: false,
        message: "Only active subscription can generate invoice",
      });
    }

    const invoiceDate = body.invoiceDate
      ? new Date(body.invoiceDate)
      : new Date();

    const dueDate = body.dueDate
      ? new Date(body.dueDate)
      : addDays(invoiceDate, 7);

    const subtotal = Number(subscription.amount);
    const gstPercent = Number(subscription.gstPercent || 0);
    const gstAmount = Number(((subtotal * gstPercent) / 100).toFixed(2));
    const totalAmount = Number((subtotal + gstAmount).toFixed(2));

    const invoice = await createInvoiceWithUniqueNo(
      {
        clientId: subscription.clientId,
        subscriptionId: subscription.id,
        invoiceDate,
        dueDate,
        billingPeriodFrom: toDate(body.billingPeriodFrom),
        billingPeriodTo: toDate(body.billingPeriodTo),
        subtotal: subtotal.toFixed(2),
        gstPercent: gstPercent.toFixed(2),
        gstAmount: gstAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        paidAmount: "0.00",
        balanceAmount: totalAmount.toFixed(2),
        status: "unpaid",
        notes: body.notes,
      },
      invoiceDate
    );

    const nextInvoiceDate = addBillingCycle(
      invoiceDate,
      subscription.billingCycle
    );

    if (nextInvoiceDate) {
      await prisma.clientSubscription.update({
        where: { id: subscription.id },
        data: {
          nextInvoiceDate,
        },
      });
    }

    return reply.code(201).send({
      success: true,
      message: "Invoice generated successfully",
      data: invoice,
    });
  } catch (error) {
    console.error("generateInvoice error:", error);

    if (isUniqueConstraintError(error)) {
      return reply.code(409).send({
        success: false,
        message:
          "Invoice number already exists. Please try again, system will generate a new number.",
      });
    }

    return reply.code(500).send({
      success: false,
      message: "Failed to generate invoice",
    });
  }
}

export async function getInvoices(request: FastifyRequest, reply: FastifyReply) {
  if (!isAdminRole(request.user.role)) {
    return reply.code(403).send({ success: false, message: "Forbidden" });
  }

  const query = request.query as {
    clientId?: string;
    status?: string;
  };

  const invoices = await prisma.clientInvoice.findMany({
    where: {
      ...(query.clientId ? { clientId: Number(query.clientId) } : {}),
      ...(query.status ? { status: query.status as any } : {}),
    },
    include: {
      client: true,
      subscription: true,
      payments: true,
    },
    orderBy: {
      invoiceDate: "desc",
    },
  });

  return reply.send({
    success: true,
    data: invoices,
  });
}

export async function getClientPortalInvoices(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const clientId = request.user.clientId;

  if (!clientId) {
    return reply.code(403).send({
      success: false,
      message: "Only client users can access invoices",
    });
  }

  const invoices = await prisma.clientInvoice.findMany({
    where: {
      clientId,
    },
    include: {
      subscription: true,
      payments: true,
    },
    orderBy: {
      invoiceDate: "desc",
    },
  });

  return reply.send({
    success: true,
    data: invoices,
  });
}