import type { FastifyReply, FastifyRequest } from "fastify";

import { handleWhatsAppWebhookPayload } from "../whatsapp-campaign/whatsapp-campaign.service.js";
import type { WhatsAppWebhookPayload } from "../whatsapp-campaign/whatsapp-campaign.types.js";

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
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "";

  if (mode === "subscribe" && token === verifyToken && challenge) {
    return reply.code(200).type("text/plain").send(challenge);
  }

  request.log.warn(
    {
      mode,
      tokenMatched: token === verifyToken,
      hasChallenge: Boolean(challenge),
    },
    "WhatsApp webhook verification failed"
  );

  return reply.code(403).send("Verification failed");
}

export async function receiveWhatsAppWebhook(
  request: FastifyRequest<{ Body: WhatsAppWebhookPayload }>,
  reply: FastifyReply
) {
  try {
    const result = await handleWhatsAppWebhookPayload(request.body || {});

    request.log.info({ result }, "WhatsApp webhook event processed");

    return reply.code(200).send({ received: true, ...result });
  } catch (error) {
    request.log.error(
      { error, body: request.body },
      "WhatsApp webhook processing failed"
    );

    return reply.code(200).send({ received: true, processed: false });
  }
}
