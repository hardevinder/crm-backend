import { FastifyReply, FastifyRequest } from "fastify";

type VerifyQuery = {
  "hub.mode"?: string;
  "hub.verify_token"?: string;
  "hub.challenge"?: string;
};

export async function verifyWhatsAppWebhook(
  request: FastifyRequest<{ Querystring: VerifyQuery }>,
  reply: FastifyReply
) {
  const mode = request.query["hub.mode"];
  const token = request.query["hub.verify_token"];
  const challenge = request.query["hub.challenge"];

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken && challenge) {
    return reply.code(200).send(challenge);
  }

  return reply.code(403).send("Verification failed");
}

export async function receiveWhatsAppWebhook(
  request: FastifyRequest,
  reply: FastifyReply
) {
  request.log.info(
    { body: request.body },
    "WhatsApp webhook event received"
  );

  return reply.code(200).send({ received: true });
}