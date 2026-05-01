import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../config/prisma.js";

const ADMIN_ROLES = ["superadmin", "admin", "accounts"];

function isAdminRole(role?: string) {
  return !!role && ADMIN_ROLES.includes(role);
}

function toDate(value?: string | null) {
  return value ? new Date(value) : undefined;
}

type CreateSubscriptionBody = {
  clientId: number;
  serviceName: string;
  billingCycle?: "monthly" | "quarterly" | "yearly" | "one_time";
  amount: number | string;
  gstPercent?: number | string;
  startDate?: string;
  endDate?: string;
  nextInvoiceDate?: string;
  remarks?: string;
};

export async function createSubscription(
  request: FastifyRequest<{ Body: CreateSubscriptionBody }>,
  reply: FastifyReply
) {
  if (!isAdminRole(request.user.role)) {
    return reply.code(403).send({ success: false, message: "Forbidden" });
  }

  const body = request.body || {};

  if (!body.clientId || !body.serviceName || body.amount === undefined) {
    return reply.code(400).send({
      success: false,
      message: "clientId, serviceName and amount are required",
    });
  }

  const amount = Number(body.amount);
  const gstPercent = Number(body.gstPercent ?? 18);

  if (!Number.isFinite(amount) || amount <= 0) {
    return reply.code(400).send({
      success: false,
      message: "Valid amount is required",
    });
  }

  const client = await prisma.client.findUnique({
    where: { id: Number(body.clientId) },
  });

  if (!client) {
    return reply.code(404).send({
      success: false,
      message: "Client not found",
    });
  }

  const subscription = await prisma.clientSubscription.create({
    data: {
      clientId: Number(body.clientId),
      serviceName: body.serviceName.trim(),
      billingCycle: body.billingCycle || "monthly",
      amount: amount.toFixed(2),
      gstPercent: gstPercent.toFixed(2),
      startDate: toDate(body.startDate),
      endDate: toDate(body.endDate),
      nextInvoiceDate: toDate(body.nextInvoiceDate),
      remarks: body.remarks,
      status: "active",
    },
    include: {
      client: true,
    },
  });

  return reply.code(201).send({
    success: true,
    message: "Subscription created successfully",
    data: subscription,
  });
}

export async function getSubscriptions(request: FastifyRequest, reply: FastifyReply) {
  if (!isAdminRole(request.user.role)) {
    return reply.code(403).send({ success: false, message: "Forbidden" });
  }

  const query = request.query as { clientId?: string; status?: string };

  const subscriptions = await prisma.clientSubscription.findMany({
    where: {
      ...(query.clientId ? { clientId: Number(query.clientId) } : {}),
      ...(query.status ? { status: query.status as any } : {}),
    },
    include: {
      client: true,
      _count: {
        select: {
          invoices: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return reply.send({
    success: true,
    data: subscriptions,
  });
}
