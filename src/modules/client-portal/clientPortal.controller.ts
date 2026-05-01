import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../config/prisma.js";

export async function getMyProfile(request: FastifyRequest, reply: FastifyReply) {
  const clientId = request.user.clientId;

  if (!clientId) {
    return reply.code(403).send({
      success: false,
      message: "Only client users can access this portal",
    });
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      subscriptions: {
        orderBy: { createdAt: "desc" },
      },
      invoices: {
        orderBy: { invoiceDate: "desc" },
        take: 5,
      },
      tickets: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  return reply.send({
    success: true,
    data: client,
  });
}
