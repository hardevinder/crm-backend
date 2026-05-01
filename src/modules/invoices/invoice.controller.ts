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

async function generateInvoiceNo(invoiceDate: Date) {
  const year = invoiceDate.getFullYear();

  const start = new Date(`${year}-01-01T00:00:00.000Z`);
  const end = new Date(`${year}-12-31T23:59:59.999Z`);

  const count = await prisma.clientInvoice.count({
    where: {
      invoiceDate: {
        gte: start,
        lte: end,
      },
    },
  });

  return `EB-INV-${year}-${String(count + 1).padStart(5, "0")}`;
}

type GenerateInvoiceBody = {
  subscriptionId: number;
  invoiceDate?: string;
  dueDate?: string;
  billingPeriodFrom?: string;
  billingPeriodTo?: string;
  notes?: string;
};

export async function generateInvoice(
  request: FastifyRequest<{ Body: GenerateInvoiceBody }>,
  reply: FastifyReply
) {
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

  const invoiceNo = await generateInvoiceNo(invoiceDate);

  const invoice = await prisma.clientInvoice.create({
    data: {
      clientId: subscription.clientId,
      subscriptionId: subscription.id,
      invoiceNo,
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
    include: {
      client: true,
      subscription: true,
    },
  });

  const nextInvoiceDate = addBillingCycle(invoiceDate, subscription.billingCycle);

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
