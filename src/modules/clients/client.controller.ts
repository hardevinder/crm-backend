import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../config/prisma.js";

const ADMIN_ROLES = ["superadmin", "admin", "accounts"];

function isAdminRole(role?: string) {
  return !!role && ADMIN_ROLES.includes(role);
}

export async function getClients(request: FastifyRequest, reply: FastifyReply) {
  if (!isAdminRole(request.user.role)) {
    return reply.code(403).send({ success: false, message: "Forbidden" });
  }

  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          users: true,
          invoices: true,
          tickets: true,
          tasks: true,
        },
      },
    },
  });

  return reply.send({
    success: true,
    data: clients,
  });
}

type CreateClientBody = {
  clientName: string;
  clientCode: string;
  clientType?: "school" | "college" | "transport" | "website" | "software" | "result_analyzer" | "other";
  contactPerson?: string;
  phone?: string;
  email?: string;
  businessName?: string;
  gstin?: string;
  address?: string;
  city?: string;
  state?: string;
  websiteUrl?: string;
  projectUrl?: string;
  notes?: string;
};

export async function createClient(
  request: FastifyRequest<{ Body: CreateClientBody }>,
  reply: FastifyReply
) {
  if (!isAdminRole(request.user.role)) {
    return reply.code(403).send({ success: false, message: "Forbidden" });
  }

  const body = request.body || {};

  if (!body.clientName || !body.clientCode) {
    return reply.code(400).send({
      success: false,
      message: "Client name and client code are required",
    });
  }

  const client = await prisma.client.create({
    data: {
      clientName: body.clientName.trim(),
      clientCode: body.clientCode.trim().toLowerCase(),
      clientType: body.clientType || "other",
      contactPerson: body.contactPerson,
      phone: body.phone,
      email: body.email,
      businessName: body.businessName,
      gstin: body.gstin,
      address: body.address,
      city: body.city,
      state: body.state,
      websiteUrl: body.websiteUrl,
      projectUrl: body.projectUrl,
      notes: body.notes,
    },
  });

  return reply.code(201).send({
    success: true,
    message: "Client created successfully",
    data: client,
  });
}
