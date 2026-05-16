import {
  ContactMethodType,
  LeadCampaignRecipientStatus,
  LeadCampaignStatus,
  LeadFollowUpType,
  LeadPriority,
  LeadSource,
  LeadStatus,
  Prisma,
  WhatsAppDirection,
  WhatsAppMessageStatus,
  WhatsAppMessageType,
  WhatsappTemplateStatus,
} from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import {
  fetchMetaTemplates,
  sendTemplateMessage,
  sendWhatsAppTextMessage,
} from "./whatsapp-meta.service.js";
import type {
  CampaignLeadFilter,
  CreateCampaignBody,
  CreateTemplateBody,
  MetaTemplate,
  PrepareCampaignRecipientsBody,
  SendCampaignBody,
  SendManualReplyBody,
  SendTemplateToLeadBody,
  UpdateCampaignBody,
  WhatsAppWebhookPayload,
} from "./whatsapp-campaign.types.js";

function toText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

export function normalizePhone(value: unknown): string | null {
  const text = toText(value);
  if (!text) return null;

  let digits = text.replace(/\D+/g, "");

  if (!digits) return null;

  if (digits.length === 10) {
    digits = `91${digits}`;
  }

  if (digits.startsWith("0") && digits.length === 11) {
    digits = `91${digits.slice(1)}`;
  }

  return digits;
}

function safeInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function getOptionalUserId(requestLike: any): number | null {
  const id = requestLike?.user?.id || requestLike?.userId;
  const userId = Number(id);
  return Number.isFinite(userId) ? userId : null;
}

function enumValue<T extends Record<string, string>>(
  enumObject: T,
  value: unknown,
  fallback?: T[keyof T]
): T[keyof T] | undefined {
  const raw = toText(value);
  if (!raw) return fallback;

  const normalized = raw.replace(/[\s-]+/g, "_").toUpperCase();
  const direct = enumObject[normalized as keyof T];

  if (direct) return direct;

  const fromValue = Object.values(enumObject).find(
    (item) => String(item).toUpperCase() === normalized
  ) as T[keyof T] | undefined;

  return fromValue || fallback;
}

function isTrue(value: unknown): boolean {
  return String(value || "").trim().toLowerCase() === "true" || value === true;
}

function isAutoReplyEnabled(): boolean {
  const value = process.env.WHATSAPP_AUTO_REPLY_ENABLED;
  return value === undefined ? true : isTrue(value);
}

function getAutoReplyText(): string | null {
  return (
    toText(process.env.WHATSAPP_AUTO_REPLY_TEXT) ||
    "Thank you ji. Our Edubridge team will contact you shortly."
  );
}

function shouldAutoReplyToMessage(message: Record<string, any>): boolean {
  const type = String(message.type || "").toLowerCase();

  return ["text", "button", "interactive"].includes(type);
}

async function findRelatedOutboundMessage(params: {
  contextProviderMessageId: string | null;
  normalizedPhone: string | null;
}) {
  if (params.contextProviderMessageId) {
    const byContext = await prisma.leadWhatsappMessage.findUnique({
      where: {
        providerMessageId: params.contextProviderMessageId,
      },
    });

    if (byContext) return byContext;
  }

  if (!params.normalizedPhone) return null;

  const since = new Date();
  since.setDate(since.getDate() - 30);

  return prisma.leadWhatsappMessage.findFirst({
    where: {
      normalizedPhone: params.normalizedPhone,
      direction: WhatsAppDirection.OUTBOUND,
      campaignRecipientId: {
        not: null,
      },
      createdAt: {
        gte: since,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

function buildLeadWhere(filters?: CampaignLeadFilter): Prisma.LeadSchoolWhereInput {
  const where: Prisma.LeadSchoolWhereInput = {
    deletedAt: null,
  };

  const and: Prisma.LeadSchoolWhereInput[] = [];

  if (filters?.search) {
    and.push({ schoolName: { contains: filters.search.trim() } });
  }

  if (filters?.state) where.state = { contains: filters.state.trim() };
  if (filters?.city) where.city = { contains: filters.city.trim() };
  if (filters?.board) where.board = { contains: filters.board.trim() };

  const status = enumValue(LeadStatus, filters?.status);
  if (status) where.status = status;

  const priority = enumValue(LeadPriority, filters?.priority);
  if (priority) where.priority = priority;

  if (isTrue(filters?.hasMobile) || isTrue(filters?.hasWhatsapp)) {
    and.push({
      OR: [
        { primaryMobile: { not: null } },
        { primaryWhatsapp: { not: null } },
        {
          contactMethods: {
            some: {
              methodType: {
                in: [ContactMethodType.MOBILE, ContactMethodType.WHATSAPP],
              },
            },
          },
        },
      ],
    });
  }

  if (and.length > 0) {
    where.AND = and;
  }

  return where;
}

function mapTemplateStatus(status?: string | null): WhatsappTemplateStatus {
  const normalized = String(status || "").trim().toUpperCase();

  if (normalized === "APPROVED") return WhatsappTemplateStatus.APPROVED;
  if (normalized === "REJECTED") return WhatsappTemplateStatus.REJECTED;
  if (normalized === "PAUSED") return WhatsappTemplateStatus.PAUSED;
  if (normalized.includes("PENDING")) return WhatsappTemplateStatus.PENDING_APPROVAL;

  return WhatsappTemplateStatus.DRAFT;
}

function extractTemplateText(template: MetaTemplate) {
  const components = template.components || [];
  const header = components.find((item) => item.type === "HEADER");
  const body = components.find((item) => item.type === "BODY");
  const footer = components.find((item) => item.type === "FOOTER");
  const buttons = components.find((item) => item.type === "BUTTONS");

  return {
    headerText: header?.text || null,
    bodyText: body?.text || "",
    footerText: footer?.text || null,
    buttonsJson: buttons?.buttons ? (buttons.buttons as Prisma.InputJsonValue) : Prisma.DbNull,
    variablesJson: body?.example ? (body.example as Prisma.InputJsonValue) : Prisma.DbNull,
  };
}

async function findLeadContactByPhone(normalizedPhone: string | null) {
  if (!normalizedPhone) return null;

  const contact = await prisma.leadContactMethod.findFirst({
    where: {
      normalizedValue: normalizedPhone,
      methodType: {
        in: [ContactMethodType.MOBILE, ContactMethodType.WHATSAPP],
      },
    },
    include: {
      leadSchool: true,
    },
    orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
  });

  if (contact) return contact;

  const lead = await prisma.leadSchool.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { primaryMobile: normalizedPhone },
        { primaryWhatsapp: normalizedPhone },
        { primaryMobile: { contains: normalizedPhone.slice(-10) } },
        { primaryWhatsapp: { contains: normalizedPhone.slice(-10) } },
      ],
    },
  });

  if (!lead) return null;

  return {
    id: null,
    leadSchoolId: lead.id,
    leadSchool: lead,
  } as any;
}

function getRecipientPhone(lead: any): {
  phoneNumber: string;
  normalizedPhoneNumber: string;
  contactMethodId: number | null;
} | null {
  const contact = (lead.contactMethods || []).find((item: any) =>
    [ContactMethodType.WHATSAPP, ContactMethodType.MOBILE].includes(item.methodType)
  );

  const phoneNumber =
    contact?.value || lead.primaryWhatsapp || lead.primaryMobile || null;

  const normalizedPhoneNumber = normalizePhone(
    contact?.normalizedValue || phoneNumber
  );

  if (!phoneNumber || !normalizedPhoneNumber) return null;

  return {
    phoneNumber,
    normalizedPhoneNumber,
    contactMethodId: contact?.id || null,
  };
}

export async function syncTemplatesFromMeta(limit = 100) {
  const templates = await fetchMetaTemplates(limit);

  const saved = [];

  for (const item of templates) {
    const text = extractTemplateText(item);

    const savedTemplate = await prisma.leadWhatsappTemplate.upsert({
      where: {
        templateName_languageCode: {
          templateName: item.name,
          languageCode: item.language || "en",
        },
      },
      create: {
        templateName: item.name,
        displayName: item.name,
        languageCode: item.language || "en",
        category: item.category || null,
        status: mapTemplateStatus(item.status),
        providerTemplateId: item.id || null,
        ...text,
      },
      update: {
        displayName: item.name,
        category: item.category || null,
        status: mapTemplateStatus(item.status),
        providerTemplateId: item.id || null,
        ...text,
      },
    });

    saved.push(savedTemplate);
  }

  return saved;
}

export async function listLocalTemplates() {
  return prisma.leadWhatsappTemplate.findMany({
    orderBy: [{ status: "asc" }, { templateName: "asc" }],
  });
}

export async function createLocalTemplate(body: CreateTemplateBody) {
  const templateName = toText(body.templateName);
  const bodyText = toText(body.bodyText);

  if (!templateName || !bodyText) {
    throw new Error("templateName and bodyText are required");
  }

  return prisma.leadWhatsappTemplate.create({
    data: {
      templateName,
      displayName: toText(body.displayName) || templateName,
      languageCode: toText(body.languageCode) || "en",
      category: toText(body.category),
      status: body.status || WhatsappTemplateStatus.DRAFT,
      headerText: toText(body.headerText),
      bodyText,
      footerText: toText(body.footerText),
      buttonsJson: body.buttonsJson as Prisma.InputJsonValue | undefined,
      variablesJson: body.variablesJson as Prisma.InputJsonValue | undefined,
      providerTemplateId: toText(body.providerTemplateId),
    },
  });
}

export async function createCampaign(body: CreateCampaignBody, requestLike?: any) {
  const title = toText(body.title);

  if (!title) {
    throw new Error("title is required");
  }

  const templateId = body.templateId ? Number(body.templateId) : null;
  const userId = getOptionalUserId(requestLike);

  const campaign = await prisma.leadCampaign.create({
    data: {
      title,
      description: toText(body.description),
      templateId: templateId && Number.isFinite(templateId) ? templateId : null,
      templateName: toText(body.templateName),
      targetFiltersJson: (body.targetFilters || {}) as Prisma.InputJsonValue,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      createdByUserId: userId,
    },
    include: {
      template: true,
      _count: {
        select: {
          recipients: true,
        },
      },
    },
  });

  if (body.leadIds?.length || body.targetFilters) {
    await prepareCampaignRecipients(campaign.id, {
      leadIds: body.leadIds,
      targetFilters: body.targetFilters,
      replaceExisting: true,
    });
  }

  return getCampaignById(campaign.id);
}

export async function updateCampaign(id: number, body: UpdateCampaignBody) {
  const existing = await prisma.leadCampaign.findUnique({ where: { id } });

  if (!existing) throw new Error("Campaign not found");

  return prisma.leadCampaign.update({
    where: { id },
    data: {
      title: body.title !== undefined ? toText(body.title) || existing.title : undefined,
      description:
        body.description !== undefined ? toText(body.description) : undefined,
      templateId:
        body.templateId !== undefined
          ? Number(body.templateId) || null
          : undefined,
      templateName:
        body.templateName !== undefined ? toText(body.templateName) : undefined,
      targetFiltersJson:
        body.targetFilters !== undefined
          ? (body.targetFilters || {}) as Prisma.InputJsonValue
          : undefined,
      scheduledAt:
        body.scheduledAt !== undefined
          ? body.scheduledAt
            ? new Date(body.scheduledAt)
            : null
          : undefined,
      status: body.status || undefined,
    },
    include: {
      template: true,
      _count: { select: { recipients: true, whatsappMessages: true } },
    },
  });
}

export async function listCampaigns(query: any) {
  const page = safeInt(query.page, 1);
  const limit = Math.min(safeInt(query.limit, 20), 100);
  const skip = (page - 1) * limit;

  const where: Prisma.LeadCampaignWhereInput = {};

  const search = toText(query.search);
  if (search) {
    where.title = { contains: search };
  }

  const status = enumValue(LeadCampaignStatus, query.status);
  if (status) where.status = status;

  const allowedSort = new Set(["createdAt", "updatedAt", "scheduledAt", "title"]);
  const sortBy = allowedSort.has(query.sortBy) ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

  const [items, total] = await prisma.$transaction([
    prisma.leadCampaign.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        template: true,
        _count: { select: { recipients: true, whatsappMessages: true } },
      },
    }),
    prisma.leadCampaign.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getCampaignById(id: number) {
  const campaign = await prisma.leadCampaign.findUnique({
    where: { id },
    include: {
      template: true,
      recipients: {
        take: 50,
        orderBy: { createdAt: "desc" },
        include: {
          leadSchool: {
            select: {
              id: true,
              schoolName: true,
              state: true,
              city: true,
              primaryMobile: true,
              primaryWhatsapp: true,
              status: true,
              priority: true,
            },
          },
        },
      },
      whatsappMessages: {
        take: 50,
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { recipients: true, whatsappMessages: true } },
    },
  });

  if (!campaign) throw new Error("Campaign not found");

  return campaign;
}

export async function listCampaignRecipients(campaignId: number, query: any) {
  const page = safeInt(query.page, 1);
  const limit = Math.min(safeInt(query.limit, 50), 200);
  const skip = (page - 1) * limit;

  const status = enumValue(LeadCampaignRecipientStatus, query.status);

  const where: Prisma.LeadCampaignRecipientWhereInput = {
    campaignId,
    ...(status ? { status } : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.leadCampaignRecipient.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        leadSchool: {
          select: {
            id: true,
            schoolName: true,
            state: true,
            city: true,
            primaryMobile: true,
            primaryWhatsapp: true,
            status: true,
            priority: true,
          },
        },
      },
    }),
    prisma.leadCampaignRecipient.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function prepareCampaignRecipients(
  campaignId: number,
  body: PrepareCampaignRecipientsBody
) {
  const campaign = await prisma.leadCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campaign not found");

  const where: Prisma.LeadSchoolWhereInput = buildLeadWhere(body.targetFilters);

  if (body.leadIds?.length) {
    const ids = body.leadIds.map(Number).filter(Number.isFinite);
    where.id = { in: ids };
  }

  const leads = await prisma.leadSchool.findMany({
    where,
    include: {
      contactMethods: {
        where: {
          methodType: {
            in: [ContactMethodType.WHATSAPP, ContactMethodType.MOBILE],
          },
        },
        orderBy: [{ methodType: "desc" }, { isPrimary: "desc" }, { id: "asc" }],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  let inserted = 0;
  let skipped = 0;

  await prisma.$transaction(async (tx) => {
    if (body.replaceExisting) {
      await tx.leadCampaignRecipient.deleteMany({ where: { campaignId } });
    }

    for (const lead of leads) {
      const recipient = getRecipientPhone(lead);

      if (!recipient) {
        skipped += 1;
        continue;
      }

      await tx.leadCampaignRecipient.upsert({
        where: {
          campaignId_normalizedPhoneNumber: {
            campaignId,
            normalizedPhoneNumber: recipient.normalizedPhoneNumber,
          },
        },
        create: {
          campaignId,
          leadSchoolId: lead.id,
          contactMethodId: recipient.contactMethodId,
          phoneNumber: recipient.phoneNumber,
          normalizedPhoneNumber: recipient.normalizedPhoneNumber,
          status: LeadCampaignRecipientStatus.PENDING,
          queuedAt: new Date(),
        },
        update: {
          leadSchoolId: lead.id,
          contactMethodId: recipient.contactMethodId,
          phoneNumber: recipient.phoneNumber,
          status: LeadCampaignRecipientStatus.PENDING,
          errorMessage: null,
          queuedAt: new Date(),
        },
      });

      inserted += 1;
    }

    await tx.leadCampaign.update({
      where: { id: campaignId },
      data: {
        totalRecipients: inserted,
        sentCount: 0,
        deliveredCount: 0,
        readCount: 0,
        replyCount: 0,
        failedCount: 0,
      },
    });
  });

  return {
    inserted,
    skipped,
    totalLeadsMatched: leads.length,
    campaign: await getCampaignById(campaignId),
  };
}

async function resolveCampaignTemplate(campaign: any) {
  if (campaign.template) {
    return {
      templateName: campaign.template.templateName,
      languageCode: campaign.template.languageCode,
    };
  }

  if (campaign.templateName) {
    return {
      templateName: campaign.templateName,
      languageCode: "en",
    };
  }

  throw new Error("Campaign template is missing");
}

export async function sendCampaign(campaignId: number, body: SendCampaignBody = {}) {
  const campaign = await prisma.leadCampaign.findUnique({
    where: { id: campaignId },
    include: {
      template: true,
      recipients: {
        where: { status: LeadCampaignRecipientStatus.PENDING },
        orderBy: { id: "asc" },
        take: Math.min(safeInt(body.limit, 200), 1000),
      },
    },
  });

  if (!campaign) throw new Error("Campaign not found");

  const template = await resolveCampaignTemplate(campaign);

  if (body.dryRun) {
    return {
      dryRun: true,
      template,
      pendingRecipients: campaign.recipients.length,
    };
  }

  await prisma.leadCampaign.update({
    where: { id: campaignId },
    data: {
      status: LeadCampaignStatus.RUNNING,
      startedAt: campaign.startedAt || new Date(),
    },
  });

  let sent = 0;
  let failed = 0;
  const errors: Array<{ recipientId: number; phoneNumber: string; error: string }> = [];

  for (const recipient of campaign.recipients) {
    try {
      const response = await sendTemplateMessage({
        to: recipient.normalizedPhoneNumber,
        templateName: template.templateName,
        languageCode: template.languageCode,
        variables: body.templateVariables,
      });

      const now = new Date();

      await prisma.$transaction([
        prisma.leadCampaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: LeadCampaignRecipientStatus.SENT,
            providerMessageId: response.messageId || null,
            errorMessage: null,
            sentAt: now,
          },
        }),
        prisma.leadWhatsappMessage.create({
          data: {
            leadSchoolId: recipient.leadSchoolId,
            contactMethodId: recipient.contactMethodId,
            campaignId: recipient.campaignId,
            campaignRecipientId: recipient.id,
            direction: WhatsAppDirection.OUTBOUND,
            messageType: WhatsAppMessageType.TEMPLATE,
            status: WhatsAppMessageStatus.SENT,
            phoneNumber: recipient.phoneNumber,
            normalizedPhone: recipient.normalizedPhoneNumber,
            templateName: template.templateName,
            campaignName: campaign.title,
            providerMessageId: response.messageId || null,
            rawPayload: response.raw as Prisma.InputJsonValue,
            queuedAt: recipient.queuedAt,
            sentAt: now,
            statusUpdatedAt: now,
          },
        }),
        prisma.leadSchool.update({
          where: { id: recipient.leadSchoolId },
          data: {
            status: LeadStatus.WHATSAPP_SENT,
            source: LeadSource.WHATSAPP,
          },
        }),
      ]);

      sent += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "Unknown WhatsApp send error";
      errors.push({ recipientId: recipient.id, phoneNumber: recipient.phoneNumber, error: message });

      await prisma.leadCampaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: LeadCampaignRecipientStatus.FAILED,
          errorMessage: message,
          failedAt: new Date(),
        },
      });
    }
  }

  const remaining = await prisma.leadCampaignRecipient.count({
    where: { campaignId, status: LeadCampaignRecipientStatus.PENDING },
  });

  await prisma.leadCampaign.update({
    where: { id: campaignId },
    data: {
      sentCount: { increment: sent },
      failedCount: { increment: failed },
      status: remaining === 0 ? LeadCampaignStatus.COMPLETED : LeadCampaignStatus.RUNNING,
      completedAt: remaining === 0 ? new Date() : null,
    },
  });

  return {
    sent,
    failed,
    remaining,
    errors,
    campaign: await getCampaignById(campaignId),
  };
}

export async function sendTemplateToLead(body: SendTemplateToLeadBody) {
  const leadSchoolId = Number(body.leadSchoolId);
  const templateName = toText(body.templateName);

  if (!Number.isFinite(leadSchoolId) && !body.phoneNumber) {
    throw new Error("leadSchoolId or phoneNumber is required");
  }

  if (!templateName) throw new Error("templateName is required");

  let lead: any = null;
  let phoneNumber = toText(body.phoneNumber);
  let normalizedPhone = normalizePhone(phoneNumber);
  let contactMethodId: number | null = null;

  if (Number.isFinite(leadSchoolId)) {
    lead = await prisma.leadSchool.findFirst({
      where: { id: leadSchoolId, deletedAt: null },
      include: {
        contactMethods: {
          where: {
            methodType: {
              in: [ContactMethodType.WHATSAPP, ContactMethodType.MOBILE],
            },
          },
          orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
        },
      },
    });

    if (!lead) throw new Error("Lead not found");

    const recipient = getRecipientPhone(lead);
    if (!recipient) throw new Error("Lead has no WhatsApp/mobile number");

    phoneNumber = recipient.phoneNumber;
    normalizedPhone = recipient.normalizedPhoneNumber;
    contactMethodId = recipient.contactMethodId;
  }

  if (!normalizedPhone || !phoneNumber) throw new Error("Invalid phone number");

  const response = await sendTemplateMessage({
    to: normalizedPhone,
    templateName,
    languageCode: body.languageCode || "en",
    variables: body.templateVariables,
  });

  const now = new Date();

  const saved = await prisma.leadWhatsappMessage.create({
    data: {
      leadSchoolId: lead?.id || null,
      contactMethodId,
      campaignId: body.campaignId ? Number(body.campaignId) : null,
      direction: WhatsAppDirection.OUTBOUND,
      messageType: WhatsAppMessageType.TEMPLATE,
      status: WhatsAppMessageStatus.SENT,
      phoneNumber,
      normalizedPhone,
      templateName,
      providerMessageId: response.messageId || null,
      rawPayload: response.raw as Prisma.InputJsonValue,
      sentAt: now,
      statusUpdatedAt: now,
    },
  });

  if (lead?.id) {
    await prisma.leadSchool.update({
      where: { id: lead.id },
      data: { status: LeadStatus.WHATSAPP_SENT, source: LeadSource.WHATSAPP },
    });
  }

  return saved;
}

export async function sendManualReplyToLead(
  body: SendManualReplyBody,
  requestLike?: any
) {
  const messageText = toText(body.message);

  if (!messageText) {
    throw new Error("message is required");
  }

  const leadSchoolId = Number((body as any).leadSchoolId || (body as any).leadId);

  let lead: any = null;
  let phoneNumber =
    toText((body as any).to) ||
    toText((body as any).phoneNumber) ||
    null;

  let normalizedPhone = normalizePhone(phoneNumber);
  let contactMethodId: number | null = null;

  if (Number.isFinite(leadSchoolId) && leadSchoolId > 0) {
    lead = await prisma.leadSchool.findFirst({
      where: {
        id: leadSchoolId,
        deletedAt: null,
      },
      include: {
        contactMethods: {
          where: {
            methodType: {
              in: [ContactMethodType.WHATSAPP, ContactMethodType.MOBILE],
            },
          },
          orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
        },
      },
    });

    if (!lead) {
      throw new Error("Lead not found");
    }

    const recipient = getRecipientPhone(lead);

    if (!recipient) {
      throw new Error("Lead has no WhatsApp/mobile number");
    }

    phoneNumber = recipient.phoneNumber;
    normalizedPhone = recipient.normalizedPhoneNumber;
    contactMethodId = recipient.contactMethodId;
  }

  if (!phoneNumber || !normalizedPhone) {
    throw new Error("leadSchoolId, leadId, to, or phoneNumber is required");
  }

  const relatedOutbound = await findRelatedOutboundMessage({
    contextProviderMessageId: null,
    normalizedPhone,
  });

  const bodyCampaignId = Number((body as any).campaignId);
  const bodyCampaignRecipientId = Number((body as any).campaignRecipientId);

  const campaignId =
    Number.isFinite(bodyCampaignId) && bodyCampaignId > 0
      ? bodyCampaignId
      : relatedOutbound?.campaignId || null;

  const campaignRecipientId =
    Number.isFinite(bodyCampaignRecipientId) && bodyCampaignRecipientId > 0
      ? bodyCampaignRecipientId
      : relatedOutbound?.campaignRecipientId || null;

  const replyToMessageId = toText((body as any).replyToMessageId);
  const userId = getOptionalUserId(requestLike);
  const now = new Date();

  const finalLeadSchoolId = lead?.id || relatedOutbound?.leadSchoolId || null;
  const finalContactMethodId =
    contactMethodId || relatedOutbound?.contactMethodId || null;

  try {
    const response = await sendWhatsAppTextMessage(
      normalizedPhone,
      messageText,
      replyToMessageId || undefined
    );

    const saved = await prisma.leadWhatsappMessage.create({
      data: {
        leadSchoolId: finalLeadSchoolId,
        contactMethodId: finalContactMethodId,
        campaignId,
        campaignRecipientId,
        direction: WhatsAppDirection.OUTBOUND,
        messageType: WhatsAppMessageType.TEXT,
        status: WhatsAppMessageStatus.SENT,
        phoneNumber,
        normalizedPhone,
        messageText,
        providerMessageId: response.messageId || null,
        contextProviderMessageId: replyToMessageId,
        rawPayload: response.raw as Prisma.InputJsonValue,
        sentAt: now,
        statusUpdatedAt: now,
      },
    });

    if (finalLeadSchoolId) {
      const currentLead = await prisma.leadSchool.findUnique({
        where: { id: finalLeadSchoolId },
      });

      await prisma.$transaction([
        prisma.leadSchool.update({
          where: { id: finalLeadSchoolId },
          data: {
            source: LeadSource.WHATSAPP,
          },
        }),
        prisma.leadFollowUp.create({
          data: {
            leadSchoolId: finalLeadSchoolId,
            followUpType: LeadFollowUpType.WHATSAPP,
            previousStatus: currentLead?.status || null,
            nextStatus: currentLead?.status || LeadStatus.WHATSAPP_SENT,
            remarks: `Manual WhatsApp reply sent${
              userId ? ` by user #${userId}` : ""
            }: ${messageText}`,
          },
        }),
      ]);
    }

    return saved;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown WhatsApp manual reply error";

    await prisma.leadWhatsappMessage.create({
      data: {
        leadSchoolId: finalLeadSchoolId,
        contactMethodId: finalContactMethodId,
        campaignId,
        campaignRecipientId,
        direction: WhatsAppDirection.OUTBOUND,
        messageType: WhatsAppMessageType.TEXT,
        status: WhatsAppMessageStatus.FAILED,
        phoneNumber,
        normalizedPhone,
        messageText,
        contextProviderMessageId: replyToMessageId,
        errorMessage,
        rawPayload: { error: errorMessage } as Prisma.InputJsonValue,
        failedAt: now,
        statusUpdatedAt: now,
      },
    });

    if (finalLeadSchoolId) {
      const currentLead = await prisma.leadSchool.findUnique({
        where: { id: finalLeadSchoolId },
      });

      await prisma.leadFollowUp.create({
        data: {
          leadSchoolId: finalLeadSchoolId,
          followUpType: LeadFollowUpType.WHATSAPP,
          previousStatus: currentLead?.status || null,
          nextStatus: currentLead?.status || LeadStatus.WHATSAPP_SENT,
          remarks: `Manual WhatsApp reply failed${
            userId ? ` by user #${userId}` : ""
          }: ${errorMessage}`,
        },
      });
    }

    throw new Error(errorMessage);
  }
}

function statusToEnums(status: string) {
  const normalized = status.toLowerCase();

  if (normalized === "sent") {
    return {
      messageStatus: WhatsAppMessageStatus.SENT,
      recipientStatus: LeadCampaignRecipientStatus.SENT,
      field: "sentAt" as const,
    };
  }

  if (normalized === "delivered") {
    return {
      messageStatus: WhatsAppMessageStatus.DELIVERED,
      recipientStatus: LeadCampaignRecipientStatus.DELIVERED,
      field: "deliveredAt" as const,
    };
  }

  if (normalized === "read") {
    return {
      messageStatus: WhatsAppMessageStatus.READ,
      recipientStatus: LeadCampaignRecipientStatus.READ,
      field: "readAt" as const,
    };
  }

  if (normalized === "failed") {
    return {
      messageStatus: WhatsAppMessageStatus.FAILED,
      recipientStatus: LeadCampaignRecipientStatus.FAILED,
      field: "failedAt" as const,
    };
  }

  return null;
}

function messageTypeFromInbound(message: Record<string, any>): WhatsAppMessageType {
  const type = String(message.type || "").toLowerCase();

  if (type === "text") return WhatsAppMessageType.TEXT;
  if (type === "button") return WhatsAppMessageType.BUTTON;
  if (type === "interactive") return WhatsAppMessageType.INTERACTIVE;
  if (type === "image") return WhatsAppMessageType.IMAGE;
  if (type === "document") return WhatsAppMessageType.DOCUMENT;
  if (type === "audio") return WhatsAppMessageType.AUDIO;
  if (type === "video") return WhatsAppMessageType.VIDEO;
  if (type === "sticker") return WhatsAppMessageType.STICKER;
  if (type === "contacts") return WhatsAppMessageType.CONTACTS;
  if (type === "location") return WhatsAppMessageType.LOCATION;
  if (type === "system") return WhatsAppMessageType.SYSTEM;

  return WhatsAppMessageType.UNKNOWN;
}

function inboundText(message: Record<string, any>): string | null {
  if (message.text?.body) return String(message.text.body);
  if (message.button?.text) return String(message.button.text);
  if (message.interactive?.button_reply?.title) {
    return String(message.interactive.button_reply.title);
  }
  if (message.interactive?.list_reply?.title) {
    return String(message.interactive.list_reply.title);
  }
  return null;
}

function inboundButton(message: Record<string, any>) {
  if (message.button) {
    return {
      text: toText(message.button.text),
      payload: toText(message.button.payload),
    };
  }

  if (message.interactive?.button_reply) {
    return {
      text: toText(message.interactive.button_reply.title),
      payload: toText(message.interactive.button_reply.id),
    };
  }

  if (message.interactive?.list_reply) {
    return {
      text: toText(message.interactive.list_reply.title),
      payload: toText(message.interactive.list_reply.id),
    };
  }

  return {
    text: null,
    payload: null,
  };
}

async function handleStatus(status: Record<string, any>, rawPayload: unknown) {
  const providerMessageId = toText(status.id);
  const statusValue = toText(status.status);

  if (!providerMessageId || !statusValue) return;

  const mapped = statusToEnums(statusValue);
  if (!mapped) return;

  const eventAt = status.timestamp
    ? new Date(Number(status.timestamp) * 1000)
    : new Date();

  const existingMessage = await prisma.leadWhatsappMessage.findUnique({
    where: { providerMessageId },
  });

  const data: Prisma.LeadWhatsappMessageUpdateInput = {
    status: mapped.messageStatus,
    rawPayload: rawPayload as Prisma.InputJsonValue,
    statusUpdatedAt: eventAt,
    providerConversationId: toText(status.conversation?.id),
    pricingCategory: toText(status.pricing?.category),
    errorMessage: status.errors?.[0]?.message || null,
    [mapped.field]: eventAt,
  };

  if (existingMessage) {
    await prisma.leadWhatsappMessage.update({
      where: { id: existingMessage.id },
      data,
    });
  } else {
    await prisma.leadWhatsappMessage.create({
      data: {
        direction: WhatsAppDirection.OUTBOUND,
        status: mapped.messageStatus,
        messageType: WhatsAppMessageType.TEMPLATE,
        phoneNumber: toText(status.recipient_id) || "unknown",
        normalizedPhone: normalizePhone(status.recipient_id),
        providerMessageId,
        rawPayload: rawPayload as Prisma.InputJsonValue,
        statusUpdatedAt: eventAt,
        providerConversationId: toText(status.conversation?.id),
        pricingCategory: toText(status.pricing?.category),
        errorMessage: status.errors?.[0]?.message || null,
        [mapped.field]: eventAt,
      },
    });
  }

  // Important:
  // Do not update a campaign recipient only by phone number here.
  // Auto-replies and manual replies also generate status events for the same phone,
  // and phone-only matching can accidentally change the original campaign recipient.
  const recipient =
    existingMessage?.campaignRecipientId
      ? await prisma.leadCampaignRecipient.findUnique({
          where: { id: existingMessage.campaignRecipientId },
        })
      : await prisma.leadCampaignRecipient.findFirst({
          where: { providerMessageId },
        });

  if (recipient) {
    const shouldIncrement = !(recipient as any)[mapped.field];

    await prisma.leadCampaignRecipient.update({
      where: { id: recipient.id },
      data: {
        status: mapped.recipientStatus,
        providerMessageId,
        errorMessage: status.errors?.[0]?.message || null,
        [mapped.field]: eventAt,
      },
    });

    if (shouldIncrement) {
      const campaignIncrement: Prisma.LeadCampaignUpdateInput = {};

      if (mapped.field === "deliveredAt") {
        campaignIncrement.deliveredCount = { increment: 1 };
      }

      if (mapped.field === "readAt") {
        campaignIncrement.readCount = { increment: 1 };
      }

      if (mapped.field === "failedAt") {
        campaignIncrement.failedCount = { increment: 1 };
      }

      if (Object.keys(campaignIncrement).length > 0) {
        await prisma.leadCampaign.update({
          where: { id: recipient.campaignId },
          data: campaignIncrement,
        });
      }
    }
  }
}

async function saveAutoReply(params: {
  to: string;
  normalizedPhone: string | null;
  text: string;
  replyToMessageId: string;
  leadSchoolId: number | null;
  contactMethodId: number | null;
  campaignId: number | null;
  campaignRecipientId: number | null;
}) {
  try {
    const response = await sendWhatsAppTextMessage(
      params.to,
      params.text,
      params.replyToMessageId
    );

    const now = new Date();

    await prisma.leadWhatsappMessage.create({
      data: {
        leadSchoolId: params.leadSchoolId,
        contactMethodId: params.contactMethodId,
        campaignId: params.campaignId,
        campaignRecipientId: params.campaignRecipientId,
        direction: WhatsAppDirection.OUTBOUND,
        messageType: WhatsAppMessageType.TEXT,
        status: WhatsAppMessageStatus.SENT,
        phoneNumber: params.to,
        normalizedPhone: params.normalizedPhone,
        messageText: params.text,
        providerMessageId: response.messageId || null,
        contextProviderMessageId: params.replyToMessageId,
        rawPayload: response.raw as Prisma.InputJsonValue,
        sentAt: now,
        statusUpdatedAt: now,
      },
    });

    return {
      sent: true,
      messageId: response.messageId,
      error: null as string | null,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown WhatsApp auto-reply error";

    const now = new Date();

    await prisma.leadWhatsappMessage.create({
      data: {
        leadSchoolId: params.leadSchoolId,
        contactMethodId: params.contactMethodId,
        campaignId: params.campaignId,
        campaignRecipientId: params.campaignRecipientId,
        direction: WhatsAppDirection.OUTBOUND,
        messageType: WhatsAppMessageType.TEXT,
        status: WhatsAppMessageStatus.FAILED,
        phoneNumber: params.to,
        normalizedPhone: params.normalizedPhone,
        messageText: params.text,
        contextProviderMessageId: params.replyToMessageId,
        errorMessage: message,
        rawPayload: { error: message } as Prisma.InputJsonValue,
        failedAt: now,
        statusUpdatedAt: now,
      },
    });

    return {
      sent: false,
      messageId: null,
      error: message,
    };
  }
}

async function handleInboundMessage(
  message: Record<string, any>,
  contact: Record<string, any> | undefined,
  rawPayload: unknown
) {
  const providerMessageId = toText(message.id);
  if (!providerMessageId) {
    return {
      saved: false,
      autoReplySent: false,
      autoReplyError: null as string | null,
    };
  }

  const existingInbound = await prisma.leadWhatsappMessage.findUnique({
    where: { providerMessageId },
    select: { id: true },
  });

  const from = toText(message.from) || toText(contact?.wa_id) || "unknown";
  const normalizedPhone = normalizePhone(from);
  const leadContact = await findLeadContactByPhone(normalizedPhone);
  const contextProviderMessageId = toText(message.context?.id);
  const relatedOutbound = await findRelatedOutboundMessage({
    contextProviderMessageId,
    normalizedPhone,
  });

  const button = inboundButton(message);
  const receivedAt = message.timestamp
    ? new Date(Number(message.timestamp) * 1000)
    : new Date();

  const leadSchoolId =
    leadContact?.leadSchoolId || relatedOutbound?.leadSchoolId || null;
  const campaignId = relatedOutbound?.campaignId || null;
  const campaignRecipientId = relatedOutbound?.campaignRecipientId || null;
  const contactMethodId =
    leadContact?.id || relatedOutbound?.contactMethodId || null;

  const savedMessage = await prisma.leadWhatsappMessage.upsert({
    where: { providerMessageId },
    create: {
      leadSchoolId,
      contactMethodId,
      campaignId,
      campaignRecipientId,
      direction: WhatsAppDirection.INBOUND,
      messageType: messageTypeFromInbound(message),
      status: WhatsAppMessageStatus.RECEIVED,
      phoneNumber: from,
      normalizedPhone,
      messageText: inboundText(message),
      buttonText: button.text,
      buttonPayload: button.payload,
      providerMessageId,
      contextProviderMessageId,
      rawPayload: rawPayload as Prisma.InputJsonValue,
      receivedAt,
      statusUpdatedAt: receivedAt,
    },
    update: {
      rawPayload: rawPayload as Prisma.InputJsonValue,
      receivedAt,
      statusUpdatedAt: receivedAt,
    },
  });

  if (leadSchoolId && !existingInbound) {
    const lead = await prisma.leadSchool.findUnique({
      where: { id: leadSchoolId },
    });

    await prisma.$transaction([
      prisma.leadSchool.update({
        where: { id: leadSchoolId },
        data: {
          status: LeadStatus.REPLY_RECEIVED,
          priority: LeadPriority.HOT,
          source: LeadSource.WHATSAPP,
        },
      }),
      prisma.leadFollowUp.create({
        data: {
          leadSchoolId,
          followUpType: LeadFollowUpType.WHATSAPP,
          previousStatus: lead?.status || null,
          nextStatus: LeadStatus.REPLY_RECEIVED,
          remarks:
            button.text ||
            savedMessage.messageText ||
            `WhatsApp reply received from ${from}`,
        },
      }),
    ]);
  }

  if (campaignRecipientId && !existingInbound) {
    const recipient = await prisma.leadCampaignRecipient.findUnique({
      where: { id: campaignRecipientId },
    });

    await prisma.leadCampaignRecipient.update({
      where: { id: campaignRecipientId },
      data: {
        status: LeadCampaignRecipientStatus.REPLIED,
        repliedAt: receivedAt,
      },
    });

    if (campaignId && !recipient?.repliedAt) {
      await prisma.leadCampaign.update({
        where: { id: campaignId },
        data: {
          replyCount: { increment: 1 },
        },
      });
    }
  }

  const autoReplyText = getAutoReplyText();
  const canAutoReply =
    !existingInbound &&
    isAutoReplyEnabled() &&
    shouldAutoReplyToMessage(message) &&
    Boolean(autoReplyText) &&
    from !== "unknown";

  if (!canAutoReply || !autoReplyText) {
    return {
      saved: true,
      autoReplySent: false,
      autoReplyError: null as string | null,
    };
  }

  const autoReply = await saveAutoReply({
    to: from,
    normalizedPhone,
    text: autoReplyText,
    replyToMessageId: providerMessageId,
    leadSchoolId,
    contactMethodId,
    campaignId,
    campaignRecipientId,
  });

  return {
    saved: true,
    autoReplySent: autoReply.sent,
    autoReplyError: autoReply.error,
  };
}

export async function handleWhatsAppWebhookPayload(payload: WhatsAppWebhookPayload) {
  let statusesHandled = 0;
  let messagesHandled = 0;
  let autoRepliesSent = 0;
  let autoRepliesFailed = 0;

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (!value) continue;

      for (const status of value.statuses || []) {
        await handleStatus(status, payload);
        statusesHandled += 1;
      }

      for (const message of value.messages || []) {
        const contact =
          value.contacts?.find((item) => item.wa_id === message.from) ||
          value.contacts?.[0];

        const result = await handleInboundMessage(message, contact, payload);

        if (result.saved) {
          messagesHandled += 1;
        }

        if (result.autoReplySent) {
          autoRepliesSent += 1;
        }

        if (result.autoReplyError) {
          autoRepliesFailed += 1;
        }
      }
    }
  }

  return {
    statusesHandled,
    messagesHandled,
    autoRepliesSent,
    autoRepliesFailed,
  };
}