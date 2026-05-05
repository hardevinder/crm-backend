import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../config/prisma.js";

const ADMIN_ROLES = ["superadmin", "admin", "accounts"] as const;

const CLIENT_TYPES = [
  "school",
  "college",
  "transport",
  "website",
  "software",
  "result_analyzer",
  "other",
] as const;

type ClientType = (typeof CLIENT_TYPES)[number];

function isAdminRole(role?: string) {
  return !!role && ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number]);
}

function cleanString(value?: string | null) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function normalizeClientCode(value?: string | null) {
  const cleaned = cleanString(value);
  return cleaned ? cleaned.toLowerCase() : undefined;
}

function parseClientId(id: string) {
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function isValidClientType(value?: string): value is ClientType {
  return !!value && CLIENT_TYPES.includes(value as ClientType);
}

function handleForbidden(request: FastifyRequest, reply: FastifyReply) {
  if (!isAdminRole(request.user.role)) {
    reply.code(403).send({ success: false, message: "Forbidden" });
    return true;
  }
  return false;
}

type ClientParams = {
  id: string;
};

type CreateClientBody = {
  clientName: string;
  clientCode: string;
  clientType?: ClientType;
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

type UpdateClientBody = {
  clientName?: string;
  clientCode?: string;
  clientType?: ClientType;
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

export async function getClients(request: FastifyRequest, reply: FastifyReply) {
  if (handleForbidden(request, reply)) return;

  try {
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
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({
      success: false,
      message: "Failed to fetch clients",
    });
  }
}

export async function getClientById(
  request: FastifyRequest<{ Params: ClientParams }>,
  reply: FastifyReply
) {
  if (handleForbidden(request, reply)) return;

  const clientId = parseClientId(request.params.id);
  if (!clientId) {
    return reply.code(400).send({
      success: false,
      message: "Invalid client ID",
    });
  }

  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
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

    if (!client) {
      return reply.code(404).send({
        success: false,
        message: "Client not found",
      });
    }

    return reply.send({
      success: true,
      data: client,
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({
      success: false,
      message: "Failed to fetch client",
    });
  }
}

export async function createClient(
  request: FastifyRequest<{ Body: CreateClientBody }>,
  reply: FastifyReply
) {
  if (handleForbidden(request, reply)) return;

  const body = request.body || ({} as CreateClientBody);

  const clientName = cleanString(body.clientName);
  const clientCode = normalizeClientCode(body.clientCode);

  if (!clientName || !clientCode) {
    return reply.code(400).send({
      success: false,
      message: "Client name and client code are required",
    });
  }

  if (body.clientType && !isValidClientType(body.clientType)) {
    return reply.code(400).send({
      success: false,
      message: "Invalid client type",
    });
  }

  try {
    const existingClient = await prisma.client.findFirst({
      where: { clientCode },
      select: { id: true },
    });

    if (existingClient) {
      return reply.code(409).send({
        success: false,
        message: "Client code already exists",
      });
    }

    const client = await prisma.client.create({
      data: {
        clientName,
        clientCode,
        clientType: body.clientType || "other",
        contactPerson: cleanString(body.contactPerson),
        phone: cleanString(body.phone),
        email: cleanString(body.email),
        businessName: cleanString(body.businessName),
        gstin: cleanString(body.gstin),
        address: cleanString(body.address),
        city: cleanString(body.city),
        state: cleanString(body.state),
        websiteUrl: cleanString(body.websiteUrl),
        projectUrl: cleanString(body.projectUrl),
        notes: cleanString(body.notes),
      },
    });

    return reply.code(201).send({
      success: true,
      message: "Client created successfully",
      data: client,
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({
      success: false,
      message: "Failed to create client",
    });
  }
}

export async function updateClient(
  request: FastifyRequest<{ Params: ClientParams; Body: UpdateClientBody }>,
  reply: FastifyReply
) {
  if (handleForbidden(request, reply)) return;

  const clientId = parseClientId(request.params.id);
  if (!clientId) {
    return reply.code(400).send({
      success: false,
      message: "Invalid client ID",
    });
  }

  const body = request.body || {};

  if (body.clientType && !isValidClientType(body.clientType)) {
    return reply.code(400).send({
      success: false,
      message: "Invalid client type",
    });
  }

  try {
    const existingClient = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });

    if (!existingClient) {
      return reply.code(404).send({
        success: false,
        message: "Client not found",
      });
    }

    const normalizedClientCode =
      body.clientCode !== undefined
        ? normalizeClientCode(body.clientCode)
        : undefined;

    if (body.clientCode !== undefined && !normalizedClientCode) {
      return reply.code(400).send({
        success: false,
        message: "Client code cannot be empty",
      });
    }

    const normalizedClientName =
      body.clientName !== undefined
        ? cleanString(body.clientName)
        : undefined;

    if (body.clientName !== undefined && !normalizedClientName) {
      return reply.code(400).send({
        success: false,
        message: "Client name cannot be empty",
      });
    }

    if (normalizedClientCode) {
      const duplicateClient = await prisma.client.findFirst({
        where: {
          clientCode: normalizedClientCode,
          NOT: { id: clientId },
        },
        select: { id: true },
      });

      if (duplicateClient) {
        return reply.code(409).send({
          success: false,
          message: "Client code already exists",
        });
      }
    }

    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: {
        ...(body.clientName !== undefined && { clientName: normalizedClientName }),
        ...(body.clientCode !== undefined && { clientCode: normalizedClientCode }),
        ...(body.clientType !== undefined && { clientType: body.clientType }),
        ...(body.contactPerson !== undefined && {
          contactPerson: cleanString(body.contactPerson) ?? null,
        }),
        ...(body.phone !== undefined && {
          phone: cleanString(body.phone) ?? null,
        }),
        ...(body.email !== undefined && {
          email: cleanString(body.email) ?? null,
        }),
        ...(body.businessName !== undefined && {
          businessName: cleanString(body.businessName) ?? null,
        }),
        ...(body.gstin !== undefined && {
          gstin: cleanString(body.gstin) ?? null,
        }),
        ...(body.address !== undefined && {
          address: cleanString(body.address) ?? null,
        }),
        ...(body.city !== undefined && {
          city: cleanString(body.city) ?? null,
        }),
        ...(body.state !== undefined && {
          state: cleanString(body.state) ?? null,
        }),
        ...(body.websiteUrl !== undefined && {
          websiteUrl: cleanString(body.websiteUrl) ?? null,
        }),
        ...(body.projectUrl !== undefined && {
          projectUrl: cleanString(body.projectUrl) ?? null,
        }),
        ...(body.notes !== undefined && {
          notes: cleanString(body.notes) ?? null,
        }),
      },
    });

    return reply.send({
      success: true,
      message: "Client updated successfully",
      data: updatedClient,
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({
      success: false,
      message: "Failed to update client",
    });
  }
}

export async function deleteClient(
  request: FastifyRequest<{ Params: ClientParams }>,
  reply: FastifyReply
) {
  if (handleForbidden(request, reply)) return;

  const clientId = parseClientId(request.params.id);
  if (!clientId) {
    return reply.code(400).send({
      success: false,
      message: "Invalid client ID",
    });
  }

  try {
    const existingClient = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });

    if (!existingClient) {
      return reply.code(404).send({
        success: false,
        message: "Client not found",
      });
    }

    await prisma.client.delete({
      where: { id: clientId },
    });

    return reply.send({
      success: true,
      message: "Client deleted successfully",
    });
  } catch (error: any) {
    request.log.error(error);

    if (error?.code === "P2003") {
      return reply.code(409).send({
        success: false,
        message:
          "Client cannot be deleted because related records exist. Remove dependent records first.",
      });
    }

    return reply.code(500).send({
      success: false,
      message: "Failed to delete client",
    });
  }
}