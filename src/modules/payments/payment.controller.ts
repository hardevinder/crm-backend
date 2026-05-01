import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../config/prisma.js";

const ADMIN_ROLES = ["superadmin", "admin", "accounts"];

function isAdminRole(role?: string) {
  return !!role && ADMIN_ROLES.includes(role);
}

function toDate(value?: string | null) {
  return value ? new Date(value) : new Date();
}

function getInvoiceStatus(totalAmount: number, paidAmount: number) {
  if (paidAmount <= 0) return "unpaid";
  if (paidAmount >= totalAmount) return "paid";
  return "partial";
}

type CreateManualPaymentBody = {
  invoiceId: number;
  amount: number | string;
  paymentMode: string;
  paymentDate?: string;
  transactionId?: string;
  referenceNo?: string;
  remarks?: string;
};

export async function createManualPayment(
  request: FastifyRequest<{ Body: CreateManualPaymentBody }>,
  reply: FastifyReply
) {
  if (!isAdminRole(request.user.role)) {
    return reply.code(403).send({
      success: false,
      message: "Forbidden",
    });
  }

  const body = request.body || {};

  if (!body.invoiceId || body.amount === undefined || !body.paymentMode) {
    return reply.code(400).send({
      success: false,
      message: "invoiceId, amount and paymentMode are required",
    });
  }

  const amount = Number(body.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return reply.code(400).send({
      success: false,
      message: "Valid payment amount is required",
    });
  }

  const invoice = await prisma.clientInvoice.findUnique({
    where: { id: Number(body.invoiceId) },
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

  if (invoice.status === "cancelled") {
    return reply.code(400).send({
      success: false,
      message: "Cannot receive payment for cancelled invoice",
    });
  }

  const currentPaid = Number(invoice.paidAmount || 0);
  const totalAmount = Number(invoice.totalAmount || 0);
  const currentBalance = Number(invoice.balanceAmount || 0);

  if (amount > currentBalance) {
    return reply.code(400).send({
      success: false,
      message: `Payment amount cannot be greater than balance amount ${currentBalance}`,
    });
  }

  const newPaidAmount = Number((currentPaid + amount).toFixed(2));
  const newBalanceAmount = Number((totalAmount - newPaidAmount).toFixed(2));
  const newStatus = getInvoiceStatus(totalAmount, newPaidAmount);

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.clientPayment.create({
      data: {
        clientId: invoice.clientId,
        invoiceId: invoice.id,
        amount: amount.toFixed(2),
        paymentMode: body.paymentMode,
        paymentStatus: "success",
        paymentDate: toDate(body.paymentDate),
        transactionId: body.transactionId,
        referenceNo: body.referenceNo,
        remarks: body.remarks,
      },
      include: {
        client: true,
        invoice: true,
      },
    });

    const updatedInvoice = await tx.clientInvoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: newPaidAmount.toFixed(2),
        balanceAmount: newBalanceAmount.toFixed(2),
        status: newStatus,
      },
      include: {
        client: true,
        subscription: true,
        payments: true,
      },
    });

    return {
      payment,
      invoice: updatedInvoice,
    };
  });

  return reply.code(201).send({
    success: true,
    message:
      newStatus === "paid"
        ? "Payment received and invoice marked as paid"
        : "Partial payment received successfully",
    data: result,
  });
}

export async function getPayments(request: FastifyRequest, reply: FastifyReply) {
  if (!isAdminRole(request.user.role)) {
    return reply.code(403).send({
      success: false,
      message: "Forbidden",
    });
  }

  const query = request.query as {
    clientId?: string;
    invoiceId?: string;
    status?: string;
  };

  const payments = await prisma.clientPayment.findMany({
    where: {
      ...(query.clientId ? { clientId: Number(query.clientId) } : {}),
      ...(query.invoiceId ? { invoiceId: Number(query.invoiceId) } : {}),
      ...(query.status ? { paymentStatus: query.status as any } : {}),
    },
    include: {
      client: true,
      invoice: true,
    },
    orderBy: {
      paymentDate: "desc",
    },
  });

  return reply.send({
    success: true,
    data: payments,
  });
}

export async function getClientPortalPayments(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const clientId = request.user.clientId;

  if (!clientId) {
    return reply.code(403).send({
      success: false,
      message: "Only client users can access payments",
    });
  }

  const payments = await prisma.clientPayment.findMany({
    where: {
      clientId,
    },
    include: {
      invoice: true,
    },
    orderBy: {
      paymentDate: "desc",
    },
  });

  return reply.send({
    success: true,
    data: payments,
  });
}
