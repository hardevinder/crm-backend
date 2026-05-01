import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../config/prisma.js";
import { comparePassword } from "../../utils/password.js";

type LoginBody = {
  email: string;
  password: string;
};

export async function login(
  request: FastifyRequest<{ Body: LoginBody }>,
  reply: FastifyReply
) {
  const { email, password } = request.body || {};

  if (!email || !password) {
    return reply.code(400).send({
      success: false,
      message: "Email and password are required",
    });
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: {
      client: true,
    },
  });

  if (!user || user.status !== "active") {
    return reply.code(401).send({
      success: false,
      message: "Invalid login details",
    });
  }

  const ok = await comparePassword(password, user.passwordHash);

  if (!ok) {
    return reply.code(401).send({
      success: false,
      message: "Invalid login details",
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const token = await reply.jwtSign({
    id: user.id,
    email: user.email,
    role: user.role,
    clientId: user.clientId,
  });

  return reply.send({
    success: true,
    message: "Login successful",
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      clientId: user.clientId,
      client: user.client
        ? {
            id: user.client.id,
            clientName: user.client.clientName,
            clientCode: user.client.clientCode,
            clientType: user.client.clientType,
          }
        : null,
    },
  });
}
