import type { FastifyReply, FastifyRequest } from "fastify";

import {
  createCampaign,
  createLocalTemplate,
  getCampaignById,
  listCampaignRecipients,
  listCampaigns,
  listLocalTemplates,
  prepareCampaignRecipients,
  sendCampaign,
  sendManualReplyToLead,
  sendTemplateToLead,
  syncTemplatesFromMeta,
  updateCampaign,
} from "./whatsapp-campaign.service.js";

import type {
  CampaignListQuery,
  CampaignRecipientQuery,
  CreateCampaignBody,
  CreateTemplateBody,
  PrepareCampaignRecipientsBody,
  SendCampaignBody,
  SendManualReplyBody,
  SendTemplateToLeadBody,
  SyncTemplatesQuery,
  UpdateCampaignBody,
} from "./whatsapp-campaign.types.js";

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function handleError(reply: FastifyReply, error: unknown) {
  const message =
    error instanceof Error ? error.message : "Internal server error";

  const lowerMessage = message.toLowerCase();

  const statusCode =
    lowerMessage.includes("not found") ? 404 :
    lowerMessage.includes("required") ? 400 :
    lowerMessage.includes("invalid") ? 400 :
    lowerMessage.includes("unauthorized") ? 401 :
    lowerMessage.includes("forbidden") ? 403 :
    500;

  return reply.code(statusCode).send({
    success: false,
    message,
  });
}

export async function listWhatsappTemplates(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const templates = await listLocalTemplates();
    return reply.send({ success: true, data: templates });
  } catch (error) {
    request.log.error({ error }, "Unable to list WhatsApp templates");
    return handleError(reply, error);
  }
}

export async function createWhatsappTemplate(
  request: FastifyRequest<{ Body: CreateTemplateBody }>,
  reply: FastifyReply
) {
  try {
    const template = await createLocalTemplate(request.body || {});
    return reply.code(201).send({ success: true, data: template });
  } catch (error) {
    request.log.error({ error }, "Unable to create WhatsApp template");
    return handleError(reply, error);
  }
}

export async function syncWhatsappTemplates(
  request: FastifyRequest<{ Querystring: SyncTemplatesQuery }>,
  reply: FastifyReply
) {
  try {
    const limit = request.query?.limit ? Number(request.query.limit) : 100;
    const templates = await syncTemplatesFromMeta(limit);

    return reply.send({
      success: true,
      message: `${templates.length} WhatsApp templates synced`,
      data: templates,
    });
  } catch (error) {
    request.log.error({ error }, "Unable to sync WhatsApp templates");
    return handleError(reply, error);
  }
}

export async function listWhatsappCampaigns(
  request: FastifyRequest<{ Querystring: CampaignListQuery }>,
  reply: FastifyReply
) {
  try {
    const result = await listCampaigns(request.query || {});

    return reply.send({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    request.log.error({ error }, "Unable to list WhatsApp campaigns");
    return handleError(reply, error);
  }
}

export async function getWhatsappCampaign(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const id = parseId(request.params.id);

    if (!id) {
      return reply.code(400).send({
        success: false,
        message: "Invalid campaign id",
      });
    }

    const campaign = await getCampaignById(id);
    return reply.send({ success: true, data: campaign });
  } catch (error) {
    request.log.error({ error }, "Unable to get WhatsApp campaign");
    return handleError(reply, error);
  }
}

export async function createWhatsappCampaign(
  request: FastifyRequest<{ Body: CreateCampaignBody }>,
  reply: FastifyReply
) {
  try {
    const campaign = await createCampaign(request.body || {}, request as any);
    return reply.code(201).send({ success: true, data: campaign });
  } catch (error) {
    request.log.error({ error }, "Unable to create WhatsApp campaign");
    return handleError(reply, error);
  }
}

export async function updateWhatsappCampaign(
  request: FastifyRequest<{
    Params: { id: string };
    Body: UpdateCampaignBody;
  }>,
  reply: FastifyReply
) {
  try {
    const id = parseId(request.params.id);

    if (!id) {
      return reply.code(400).send({
        success: false,
        message: "Invalid campaign id",
      });
    }

    const campaign = await updateCampaign(id, request.body || {});
    return reply.send({ success: true, data: campaign });
  } catch (error) {
    request.log.error({ error }, "Unable to update WhatsApp campaign");
    return handleError(reply, error);
  }
}

export async function prepareWhatsappCampaignRecipients(
  request: FastifyRequest<{
    Params: { id: string };
    Body: PrepareCampaignRecipientsBody;
  }>,
  reply: FastifyReply
) {
  try {
    const id = parseId(request.params.id);

    if (!id) {
      return reply.code(400).send({
        success: false,
        message: "Invalid campaign id",
      });
    }

    const result = await prepareCampaignRecipients(id, request.body || {});
    return reply.send({ success: true, ...result });
  } catch (error) {
    request.log.error(
      { error },
      "Unable to prepare WhatsApp campaign recipients"
    );
    return handleError(reply, error);
  }
}

export async function listWhatsappCampaignRecipients(
  request: FastifyRequest<{
    Params: { id: string };
    Querystring: CampaignRecipientQuery;
  }>,
  reply: FastifyReply
) {
  try {
    const id = parseId(request.params.id);

    if (!id) {
      return reply.code(400).send({
        success: false,
        message: "Invalid campaign id",
      });
    }

    const result = await listCampaignRecipients(id, request.query || {});

    return reply.send({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    request.log.error(
      { error },
      "Unable to list WhatsApp campaign recipients"
    );
    return handleError(reply, error);
  }
}

export async function sendWhatsappCampaign(
  request: FastifyRequest<{
    Params: { id: string };
    Body: SendCampaignBody;
  }>,
  reply: FastifyReply
) {
  try {
    const id = parseId(request.params.id);

    if (!id) {
      return reply.code(400).send({
        success: false,
        message: "Invalid campaign id",
      });
    }

    const result = await sendCampaign(id, request.body || {});
    return reply.send({ success: true, ...result });
  } catch (error) {
    request.log.error({ error }, "Unable to send WhatsApp campaign");
    return handleError(reply, error);
  }
}

export async function sendTemplateToSingleLead(
  request: FastifyRequest<{ Body: SendTemplateToLeadBody }>,
  reply: FastifyReply
) {
  try {
    const result = await sendTemplateToLead(request.body || {});

    return reply.send({
      success: true,
      message: "WhatsApp template sent successfully",
      data: result,
    });
  } catch (error) {
    request.log.error({ error }, "Unable to send WhatsApp template to lead");
    return handleError(reply, error);
  }
}

/**
 * Manual reply from admin/team to a WhatsApp lead.
 *
 * This is for normal text replies inside the WhatsApp 24-hour customer service window.
 * Example body:
 * {
 *   "leadId": 12,
 *   "message": "Thank you ji, our team will contact you shortly."
 * }
 *
 * OR:
 * {
 *   "to": "919876543210",
 *   "message": "Thank you ji, our team will contact you shortly."
 * }
 */
export async function sendManualWhatsappReply(
  request: FastifyRequest<{ Body: SendManualReplyBody }>,
  reply: FastifyReply
) {
  try {
    const result = await sendManualReplyToLead(
      request.body || {},
      request as any
    );

    return reply.send({
      success: true,
      message: "Manual WhatsApp reply sent successfully",
      data: result,
    });
  } catch (error) {
    request.log.error({ error }, "Unable to send manual WhatsApp reply");
    return handleError(reply, error);
  }
}