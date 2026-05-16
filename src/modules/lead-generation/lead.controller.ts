import type { FastifyReply, FastifyRequest } from "fastify";
import * as XLSX from "xlsx";
import type { Prisma } from "@prisma/client";
import {
  ContactMethodType,
  LeadFollowUpType,
  LeadImportStatus,
  LeadPriority,
  LeadSource,
  LeadStatus,
} from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import type {
  CreateLeadBody,
  LeadContactInput,
  UpdateLeadBody,
} from "./lead.types.js";
import {
  normalizeContactValue,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  normalizeState,
  parseExcelDate,
  parseNumber,
  pick,
  toText,
  uniqueByNormalized,
} from "./lead.utils.js";

type ListQuery = {
  page?: string;
  limit?: string;
  search?: string;
  state?: string;
  city?: string;
  status?: string;
  priority?: string;
  source?: string;
  board?: string;
  hasMobile?: string;
  hasEmail?: string;
  assignedToUserId?: string;
  sortBy?: "createdAt" | "updatedAt" | "schoolName" | "state" | "status";
  sortOrder?: "asc" | "desc";
};

type EnumLike = Record<string, string>;

function safeInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function enumFromInput<T extends EnumLike>(
  enumObject: T,
  value: unknown,
  fallback: T[keyof T]
): T[keyof T] {
  const raw = toText(value);

  if (!raw) return fallback;

  const normalized = raw
    .trim()
    .replace(/[\s-]+/g, "_")
    .toUpperCase();

  const values = Object.values(enumObject) as Array<T[keyof T]>;

  const exactValue = values.find((item) => item === raw);
  if (exactValue) return exactValue;

  const normalizedValue = values.find(
    (item) => String(item).toUpperCase() === normalized
  );
  if (normalizedValue) return normalizedValue;

  const keyValue = enumObject[normalized as keyof T];
  if (keyValue) return keyValue;

  const aliasMap: Record<string, string> = {
    NEW: "NEW_LEAD",
    NEWLEAD: "NEW_LEAD",
    NEW_LEADS: "NEW_LEAD",
    FOLLOWUP: "FOLLOW_UP_REQUIRED",
    FOLLOW_UP: "FOLLOW_UP_REQUIRED",
    FOLLOWUP_REQUIRED: "FOLLOW_UP_REQUIRED",
    QUOTATION: "QUOTATION_SENT",
    QUOTE_SENT: "QUOTATION_SENT",
    DEMO: "DEMO_SCHEDULED",
    NOTINTERESTED: "NOT_INTERESTED",
    WRONG: "WRONG_NUMBER",
    WRONGNO: "WRONG_NUMBER",
    WRONG_NUMBERED: "WRONG_NUMBER",
    EXCEL: "EXCEL_IMPORT",
    UPLOAD: "EXCEL_IMPORT",
    GOOGLE_SEARCH: "GOOGLE",
    WEB: "WEBSITE",
    PHONE: "CALL",
    NOTES: "NOTE",
  };

  const alias = aliasMap[normalized] || aliasMap[normalized.replace(/_/g, "")];
  if (alias && enumObject[alias as keyof T]) {
    return enumObject[alias as keyof T];
  }

  return fallback;
}

function toLeadStatus(value: unknown): LeadStatus {
  return enumFromInput(LeadStatus, value, LeadStatus.NEW_LEAD);
}

function toOptionalLeadStatus(value: unknown): LeadStatus | undefined {
  if (value === undefined) return undefined;
  return toLeadStatus(value);
}

function toNullableLeadStatus(value: unknown): LeadStatus | null {
  const raw = toText(value);
  if (!raw) return null;
  return toLeadStatus(raw);
}

function toLeadPriority(value: unknown): LeadPriority {
  return enumFromInput(LeadPriority, value, LeadPriority.WARM);
}

function toOptionalLeadPriority(value: unknown): LeadPriority | undefined {
  if (value === undefined) return undefined;
  return toLeadPriority(value);
}

function toLeadSource(value: unknown): LeadSource {
  return enumFromInput(LeadSource, value, LeadSource.MANUAL);
}

function toOptionalLeadSource(value: unknown): LeadSource | undefined {
  if (value === undefined) return undefined;
  return toLeadSource(value);
}

function toFollowUpType(value: unknown): LeadFollowUpType {
  return enumFromInput(LeadFollowUpType, value, LeadFollowUpType.NOTE);
}

function toContactMethodType(value: unknown): ContactMethodType | null {
  const raw = toText(value);
  if (!raw) return null;
  return enumFromInput(ContactMethodType, raw, ContactMethodType.MOBILE);
}

function buildPrimaryFields(contactMethods: LeadContactInput[]) {
  const firstMobile = contactMethods.find(
    (c) => c.methodType === ContactMethodType.MOBILE || c.methodType === ContactMethodType.WHATSAPP
  );
  const firstLandline = contactMethods.find(
    (c) => c.methodType === ContactMethodType.LANDLINE
  );
  const firstEmail = contactMethods.find(
    (c) => c.methodType === ContactMethodType.EMAIL
  );

  return {
    primaryMobile: firstMobile?.value || null,
    primaryWhatsapp: firstMobile?.value || null,
    primaryLandline: firstLandline?.value || null,
    primaryEmail: firstEmail?.value || null,
  };
}

function prepareContactMethods(contactMethods: LeadContactInput[] = []) {
  const prepared = contactMethods
    .map((c) => {
      const methodType = toContactMethodType(c.methodType);
      if (!methodType) return null;

      const normalizedValue = normalizeContactValue(methodType, c.value);
      const value = toText(c.value);

      if (!value || !normalizedValue) return null;

      return {
        methodType,
        value,
        normalizedValue,
        label: c.label || null,
        isPrimary: Boolean(c.isPrimary),
        sourceUrl: c.sourceUrl || null,
        verificationStatus: c.verificationStatus || null,
        notes: c.notes || null,
      };
    })
    .filter(Boolean) as Array<{
    methodType: ContactMethodType;
    value: string;
    normalizedValue: string;
    label: string | null;
    isPrimary: boolean;
    sourceUrl: string | null;
    verificationStatus: string | null;
    notes: string | null;
  }>;

  return uniqueByNormalized(prepared);
}

function isTrueQuery(value: unknown): boolean {
  return String(value || "").trim().toLowerCase() === "true";
}

function buildLeadWhere(query: ListQuery): Prisma.LeadSchoolWhereInput {
  const where: Prisma.LeadSchoolWhereInput = {
    deletedAt: null,
  };

  const andFilters: Prisma.LeadSchoolWhereInput[] = [];

  // First search box should search by school name only.
  // Other filters like state/city/status remain separate filters.
  const schoolSearch = toText(query.search);
  if (schoolSearch) {
    andFilters.push({
      schoolName: {
        contains: schoolSearch,
      },
    });
  }

  if (query.state) where.state = { contains: query.state.trim() };
  if (query.city) where.city = { contains: query.city.trim() };
  if (query.status) where.status = toLeadStatus(query.status);
  if (query.priority) where.priority = toLeadPriority(query.priority);
  if (query.source) where.source = toLeadSource(query.source);
  if (query.board) where.board = { contains: query.board.trim() };

  if (query.assignedToUserId) {
    const assignedToUserId = Number(query.assignedToUserId);
    if (Number.isFinite(assignedToUserId)) {
      where.assignedToUserId = assignedToUserId;
    }
  }

  // Important: keep hasMobile/hasEmail inside AND so search + hasMobile
  // means "school name matches AND lead has mobile", not a loose OR.
  if (isTrueQuery(query.hasMobile)) {
    andFilters.push({
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

  if (isTrueQuery(query.hasEmail)) {
    andFilters.push({
      OR: [
        { primaryEmail: { not: null } },
        {
          contactMethods: {
            some: {
              methodType: ContactMethodType.EMAIL,
            },
          },
        },
      ],
    });
  }

  if (andFilters.length > 0) {
    where.AND = andFilters;
  }

  return where;
}

function getLeadOrderBy(query: ListQuery): Prisma.LeadSchoolOrderByWithRelationInput {
  const allowedSortBy = new Set([
    "createdAt",
    "updatedAt",
    "schoolName",
    "state",
    "status",
  ]);

  const sortBy =
    query.sortBy && allowedSortBy.has(query.sortBy)
      ? query.sortBy
      : "createdAt";

  const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

  return { [sortBy]: sortOrder };
}

export async function listLeads(request: FastifyRequest, reply: FastifyReply) {
  const query = request.query as ListQuery;

  const page = safeInt(query.page, 1);
  const limit = Math.min(safeInt(query.limit, 25), 100);
  const skip = (page - 1) * limit;

  const where = buildLeadWhere(query);
  const orderBy = getLeadOrderBy(query);

  const [items, total] = await prisma.$transaction([
    prisma.leadSchool.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        contactMethods: {
          orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
          take: 10,
        },
        _count: {
          select: {
            followUps: true,
            whatsappMessages: true,
          },
        },
      },
    }),
    prisma.leadSchool.count({ where }),
  ]);

  return reply.send({
    success: true,
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}


export async function getLeadById(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = request.params as { id: string };

  const leadId = Number(id);
  if (!Number.isFinite(leadId)) {
    return reply.code(400).send({
      success: false,
      message: "Invalid lead id",
    });
  }

  const lead = await prisma.leadSchool.findFirst({
    where: {
      id: leadId,
      deletedAt: null,
    },
    include: {
      contactMethods: {
        orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
      },
      followUps: {
        orderBy: { followUpAt: "desc" },
        take: 50,
      },
      whatsappMessages: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      importBatch: true,
    },
  });

  if (!lead) {
    return reply.code(404).send({
      success: false,
      message: "Lead not found",
    });
  }

  return reply.send({
    success: true,
    data: lead,
  });
}

export async function createLead(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const body = request.body as CreateLeadBody;

  const schoolName = toText(body.schoolName);

  if (!schoolName) {
    return reply.code(400).send({
      success: false,
      message: "schoolName is required",
    });
  }

  const normalizedName = normalizeName(schoolName);
  const normalizedState = normalizeState(body.state);
  const contacts = prepareContactMethods(body.contactMethods || []);
  const primary = buildPrimaryFields(contacts);

  const existing = await prisma.leadSchool.findUnique({
    where: {
      normalizedName_normalizedState: {
        normalizedName,
        normalizedState,
      },
    },
  });

  if (existing && !existing.deletedAt) {
    return reply.code(409).send({
      success: false,
      message: "Lead already exists for this school/state",
      existingLeadId: existing.id,
    });
  }

  const created = await prisma.$transaction(async (tx) => {
    const lead = await tx.leadSchool.create({
      data: {
        schoolName,
        normalizedName,

        schoolType: body.schoolType || null,
        schoolCategory: body.schoolCategory || "PRIVATE",
        board: body.board || null,

        state: body.state || null,
        normalizedState,
        city: body.city || null,
        district: body.district || null,
        address: body.address || null,
        website: body.website || null,

        status: toLeadStatus(body.status),
        priority: toLeadPriority(body.priority),
        source: toLeadSource(body.source),

        sourceLabel: body.sourceLabel || null,
        verificationStatus: body.verificationStatus || null,
        contactNotes: body.contactNotes || null,
        manualSearchLink: body.manualSearchLink || null,

        assignedToUserId: body.assignedToUserId || null,

        ...primary,

        contactMethods: {
          create: contacts,
        },
      },
      include: {
        contactMethods: true,
      },
    });

    return lead;
  });

  return reply.code(201).send({
    success: true,
    data: created,
  });
}

export async function updateLead(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = request.params as { id: string };
  const body = request.body as UpdateLeadBody;

  const leadId = Number(id);
  if (!Number.isFinite(leadId)) {
    return reply.code(400).send({
      success: false,
      message: "Invalid lead id",
    });
  }

  const existing = await prisma.leadSchool.findFirst({
    where: {
      id: leadId,
      deletedAt: null,
    },
  });

  if (!existing) {
    return reply.code(404).send({
      success: false,
      message: "Lead not found",
    });
  }

  const schoolName =
    body.schoolName !== undefined ? toText(body.schoolName) : existing.schoolName;

  if (!schoolName) {
    return reply.code(400).send({
      success: false,
      message: "schoolName cannot be empty",
    });
  }

  const normalizedName =
    body.schoolName !== undefined
      ? normalizeName(schoolName)
      : existing.normalizedName;

  const normalizedState =
    body.state !== undefined
      ? normalizeState(body.state)
      : existing.normalizedState;

  const contacts = body.contactMethods
    ? prepareContactMethods(body.contactMethods)
    : null;

  const primary = contacts ? buildPrimaryFields(contacts) : {};

  const updated = await prisma.$transaction(async (tx) => {
    if (contacts) {
      await tx.leadContactMethod.deleteMany({
        where: {
          leadSchoolId: existing.id,
        },
      });
    }

    const lead = await tx.leadSchool.update({
      where: {
        id: existing.id,
      },
      data: {
        schoolName,
        normalizedName,
        normalizedState,

        schoolType:
          body.schoolType !== undefined ? body.schoolType || null : undefined,
        schoolCategory:
          body.schoolCategory !== undefined ? body.schoolCategory : undefined,
        board: body.board !== undefined ? body.board || null : undefined,

        state: body.state !== undefined ? body.state || null : undefined,
        city: body.city !== undefined ? body.city || null : undefined,
        district:
          body.district !== undefined ? body.district || null : undefined,
        address: body.address !== undefined ? body.address || null : undefined,
        website: body.website !== undefined ? body.website || null : undefined,

        status: toOptionalLeadStatus(body.status),
        priority: toOptionalLeadPriority(body.priority),
        source: toOptionalLeadSource(body.source),

        sourceLabel:
          body.sourceLabel !== undefined ? body.sourceLabel || null : undefined,
        verificationStatus:
          body.verificationStatus !== undefined
            ? body.verificationStatus || null
            : undefined,
        contactNotes:
          body.contactNotes !== undefined ? body.contactNotes || null : undefined,
        manualSearchLink:
          body.manualSearchLink !== undefined
            ? body.manualSearchLink || null
            : undefined,

        assignedToUserId:
          body.assignedToUserId !== undefined
            ? body.assignedToUserId || null
            : undefined,

        ...primary,

        ...(contacts
          ? {
              contactMethods: {
                create: contacts,
              },
            }
          : {}),
      },
      include: {
        contactMethods: true,
      },
    });

    return lead;
  });

  return reply.send({
    success: true,
    data: updated,
  });
}

export async function deleteLead(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = request.params as { id: string };

  const leadId = Number(id);
  if (!Number.isFinite(leadId)) {
    return reply.code(400).send({
      success: false,
      message: "Invalid lead id",
    });
  }

  const existing = await prisma.leadSchool.findFirst({
    where: {
      id: leadId,
      deletedAt: null,
    },
  });

  if (!existing) {
    return reply.code(404).send({
      success: false,
      message: "Lead not found",
    });
  }

  await prisma.leadSchool.update({
    where: {
      id: existing.id,
    },
    data: {
      deletedAt: new Date(),
    },
  });

  return reply.send({
    success: true,
    message: "Lead deleted successfully",
  });
}

export async function getLeadDashboard(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const [
    totalLeads,
    hotLeads,
    converted,
    todayFollowUps,
    statusWise,
    stateWise,
  ] = await prisma.$transaction([
    prisma.leadSchool.count({
      where: {
        deletedAt: null,
      },
    }),
    prisma.leadSchool.count({
      where: {
        deletedAt: null,
        priority: LeadPriority.HOT,
      },
    }),
    prisma.leadSchool.count({
      where: {
        deletedAt: null,
        status: LeadStatus.CONVERTED,
      },
    }),
    prisma.leadFollowUp.count({
      where: {
        nextFollowUpAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    }),
    prisma.leadSchool.groupBy({
      by: ["status"],
      where: {
        deletedAt: null,
      },
      _count: {
        status: true,
      },
    }),
    prisma.leadSchool.groupBy({
      by: ["state"],
      where: {
        deletedAt: null,
      },
      _count: {
        state: true,
      },
      orderBy: {
        _count: {
          state: "desc",
        },
      },
      take: 10,
    }),
  ]);

  return reply.send({
    success: true,
    data: {
      totalLeads,
      hotLeads,
      converted,
      todayFollowUps,
      statusWise,
      stateWise,
    },
  });
}

export async function createFollowUp(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = request.params as { id: string };

  const body = request.body as {
    followUpType?: string;
    remarks?: string;
    nextStatus?: string;
    nextFollowUpAt?: string;
    handledByUserId?: number;
  };

  const leadId = Number(id);
  if (!Number.isFinite(leadId)) {
    return reply.code(400).send({
      success: false,
      message: "Invalid lead id",
    });
  }

  const lead = await prisma.leadSchool.findFirst({
    where: {
      id: leadId,
      deletedAt: null,
    },
  });

  if (!lead) {
    return reply.code(404).send({
      success: false,
      message: "Lead not found",
    });
  }

  if (!body.remarks?.trim()) {
    return reply.code(400).send({
      success: false,
      message: "remarks is required",
    });
  }

  const nextStatus = toNullableLeadStatus(body.nextStatus);

  const result = await prisma.$transaction(async (tx) => {
    const followUp = await tx.leadFollowUp.create({
      data: {
        leadSchoolId: lead.id,
        followUpType: toFollowUpType(body.followUpType),
        remarks: body.remarks!.trim(),
        previousStatus: lead.status,
        nextStatus,
        nextFollowUpAt: body.nextFollowUpAt
          ? new Date(body.nextFollowUpAt)
          : null,
        handledByUserId: body.handledByUserId || null,
      },
    });

    if (nextStatus) {
      await tx.leadSchool.update({
        where: {
          id: lead.id,
        },
        data: {
          status: nextStatus,
        },
      });
    }

    return followUp;
  });

  return reply.code(201).send({
    success: true,
    data: result,
  });
}

export async function listFollowUps(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = request.params as { id: string };

  const leadId = Number(id);
  if (!Number.isFinite(leadId)) {
    return reply.code(400).send({
      success: false,
      message: "Invalid lead id",
    });
  }

  const items = await prisma.leadFollowUp.findMany({
    where: {
      leadSchoolId: leadId,
    },
    orderBy: {
      followUpAt: "desc",
    },
  });

  return reply.send({
    success: true,
    data: items,
  });
}


type ParsedExcelLead = {
  schoolName: string;
  state: string;
  schoolType: string;
  streamsFound: string;
  latestDateTime: Date | null;
  latestFile: string;
  totalFilesVersions: number | null;
  sizeKb: number | null;
  verificationStatus: string;
  contactNotes: string;
  manualSearchLink: string;
  contacts: LeadContactInput[];
};

type ImportPrimaryFields = {
  primaryMobile?: string | null;
  primaryWhatsapp?: string | null;
  primaryEmail?: string | null;
};

function splitContactCell(value: unknown): string[] {
  const text = toText(value);
  if (!text) return [];

  return text
    .split(/[\n,;|]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function indexedColumns(baseNames: string[], index: number): string[] {
  const names: string[] = [];

  for (const baseName of baseNames) {
    if (index === 1) {
      names.push(baseName);
    }

    names.push(
      `${baseName} ${index}`,
      `${baseName}${index}`,
      `${baseName} No ${index}`,
      `${baseName} No. ${index}`,
      `${baseName} Number ${index}`,
      `${baseName} Number. ${index}`
    );
  }

  return names;
}

function addExcelContactsFromCell(params: {
  contacts: LeadContactInput[];
  methodType: ContactMethodType.MOBILE | ContactMethodType.EMAIL;
  value: unknown;
  label: string;
  isPrimary: boolean;
  sourceUrl: string | null;
  verificationStatus: string;
  notes: string;
}) {
  const {
    contacts,
    methodType,
    value,
    label,
    isPrimary,
    sourceUrl,
    verificationStatus,
    notes,
  } = params;

  for (const item of splitContactCell(value)) {
    const isValid =
      methodType === ContactMethodType.EMAIL
        ? Boolean(normalizeEmail(item))
        : Boolean(normalizePhone(item));

    if (!isValid) continue;

    contacts.push({
      methodType,
      value: item,
      label,
      isPrimary,
      sourceUrl,
      verificationStatus,
      notes,
    });
  }
}

function buildImportPrimaryFields(contactMethods: LeadContactInput[]): ImportPrimaryFields {
  const firstMobile = contactMethods.find(
    (contact) => contact.methodType === ContactMethodType.MOBILE
  );
  const firstEmail = contactMethods.find(
    (contact) => contact.methodType === ContactMethodType.EMAIL
  );

  const primary: ImportPrimaryFields = {};

  if (firstMobile?.value) {
    primary.primaryMobile = firstMobile.value;
    primary.primaryWhatsapp = firstMobile.value;
  }

  if (firstEmail?.value) {
    primary.primaryEmail = firstEmail.value;
  }

  return primary;
}

function excelRowToLead(row: Record<string, unknown>): ParsedExcelLead {
  const schoolName = toText(pick(row, ["School Name", "School", "Name"]));
  const state = toText(pick(row, ["State"]));
  const verificationStatus = toText(
    pick(row, ["Verification Status", "Verification"])
  );
  const notes = toText(pick(row, ["Contact Notes", "Notes", "Remarks"]));
  const manualSearchLink = toText(
    pick(row, ["Manual Search Link", "Search Link"])
  );
  const sourceUrl1 = toText(pick(row, ["Source URL 1", "Source 1"]));
  const sourceUrl2 = toText(pick(row, ["Source URL 2", "Source 2"]));
  const sourceUrl3 = toText(pick(row, ["Source URL 3", "Source 3"]));

  const contacts: LeadContactInput[] = [];
  const sourceUrls =
    [sourceUrl1, sourceUrl2, sourceUrl3].filter(Boolean).join(" | ") || null;

  const mobileBaseNames = [
    "Mobile",
    "Mobile No",
    "Mobile No.",
    "Mobile Number",
    "Phone",
    "Phone No",
    "Phone No.",
    "Phone Number",
    "Contact",
    "Contact No",
    "Contact No.",
    "Contact Number",
    "Whatsapp",
    "WhatsApp",
  ];

  const emailBaseNames = [
    "Email",
    "Email ID",
    "Email Id",
    "Email Address",
    "E-mail",
    "E-mail ID",
    "E-mail Id",
    "E-mail Address",
    "Mail",
  ];

  // This file has Mobile 1-4 and Email 1-4. Keeping 10 makes future imports safer.
  for (let i = 1; i <= 10; i += 1) {
    const mobileValue = pick(row, indexedColumns(mobileBaseNames, i));

    addExcelContactsFromCell({
      contacts,
      methodType: ContactMethodType.MOBILE,
      value: mobileValue,
      label: `Mobile ${i}`,
      isPrimary: i === 1,
      sourceUrl: sourceUrls,
      verificationStatus,
      notes,
    });

    const emailValue = pick(row, indexedColumns(emailBaseNames, i));

    addExcelContactsFromCell({
      contacts,
      methodType: ContactMethodType.EMAIL,
      value: emailValue,
      label: `Email ${i}`,
      isPrimary: i === 1,
      sourceUrl: sourceUrls,
      verificationStatus,
      notes,
    });
  }

  return {
    schoolName,
    state,
    schoolType: toText(pick(row, ["School Type", "Type"])),
    streamsFound: toText(pick(row, ["Streams Found", "Streams"])),
    latestDateTime: parseExcelDate(
      pick(row, ["Latest Date Time", "Latest Date", "Date"])
    ),
    latestFile: toText(pick(row, ["Latest File", "File"])),
    totalFilesVersions: parseNumber(
      pick(row, ["Total Files/Versions", "Total Files", "Versions"])
    ),
    sizeKb: parseNumber(pick(row, ["Size KB", "Size"])),
    verificationStatus,
    contactNotes: notes,
    manualSearchLink,
    contacts,
  };
}

export async function importLeadsFromExcel(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const multipartRequest = request as FastifyRequest & {
    file: () => Promise<
      | {
          filename: string;
          mimetype: string;
          toBuffer: () => Promise<Buffer>;
        }
      | undefined
    >;
  };

  const file = await multipartRequest.file();

  if (!file) {
    return reply.code(400).send({
      success: false,
      message: "Excel file is required in field name 'file'",
    });
  }

  const buffer = await file.toBuffer();

  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
  });

  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return reply.code(400).send({
      success: false,
      message: "Excel file does not contain any sheet",
    });
  }

  const worksheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: null,
    raw: false,
  });

  const importBatch = await prisma.leadImportBatch.create({
    data: {
      filename: file.filename,
      sheetName,
      totalRows: rows.length,
      status: LeadImportStatus.PROCESSING,
    },
  });

  let successRows = 0;
  let failedRows = 0;
  let skippedRows = 0;
  let rowsWithContacts = 0;
  let rowsWithoutContacts = 0;
  let parsedMobileContacts = 0;
  let parsedEmailContacts = 0;

  const errors: Array<{
    row: number;
    schoolName?: string | null;
    error: string;
  }> = [];

  for (let index = 0; index < rows.length; index += 1) {
    const rowNumber = index + 2;
    const parsed = excelRowToLead(rows[index]);

    if (!parsed.schoolName) {
      skippedRows += 1;
      errors.push({
        row: rowNumber,
        error: "Missing School Name",
      });
      continue;
    }

    const normalizedName = normalizeName(parsed.schoolName);
    const normalizedState = normalizeState(parsed.state);
    const contacts = prepareContactMethods(parsed.contacts);
    const primary = buildImportPrimaryFields(contacts);

    const mobileCount = contacts.filter(
      (contact) => contact.methodType === ContactMethodType.MOBILE
    ).length;
    const emailCount = contacts.filter(
      (contact) => contact.methodType === ContactMethodType.EMAIL
    ).length;

    parsedMobileContacts += mobileCount;
    parsedEmailContacts += emailCount;

    if (contacts.length > 0) {
      rowsWithContacts += 1;
    } else {
      rowsWithoutContacts += 1;
    }

    try {
      await prisma.$transaction(async (tx) => {
        const lead = await tx.leadSchool.upsert({
          where: {
            normalizedName_normalizedState: {
              normalizedName,
              normalizedState,
            },
          },
          create: {
            schoolName: parsed.schoolName,
            normalizedName,

            schoolType: parsed.schoolType || null,
            schoolCategory: "PRIVATE",

            state: parsed.state || null,
            normalizedState,

            streamsFound: parsed.streamsFound || null,
            latestDateTime: parsed.latestDateTime,
            latestFile: parsed.latestFile || null,
            totalFilesVersions: parsed.totalFilesVersions,
            sizeKb: parsed.sizeKb,

            status: LeadStatus.NEW_LEAD,
            priority: LeadPriority.WARM,
            source: LeadSource.EXCEL_IMPORT,

            verificationStatus: parsed.verificationStatus || null,
            contactNotes: parsed.contactNotes || null,
            manualSearchLink: parsed.manualSearchLink || null,

            importedBatchId: importBatch.id,

            ...primary,
          },
          update: {
            schoolName: parsed.schoolName,
            schoolType: parsed.schoolType || undefined,
            schoolCategory: "PRIVATE",

            state: parsed.state || undefined,
            normalizedState,

            streamsFound: parsed.streamsFound || undefined,
            latestDateTime: parsed.latestDateTime || undefined,
            latestFile: parsed.latestFile || undefined,
            totalFilesVersions: parsed.totalFilesVersions || undefined,
            sizeKb: parsed.sizeKb || undefined,

            source: LeadSource.EXCEL_IMPORT,

            verificationStatus: parsed.verificationStatus || undefined,
            contactNotes: parsed.contactNotes || undefined,
            manualSearchLink: parsed.manualSearchLink || undefined,

            importedBatchId: importBatch.id,
            deletedAt: null,

            ...primary,
          },
        });

        for (const contact of contacts) {
          await tx.leadContactMethod.upsert({
            where: {
              leadSchoolId_methodType_normalizedValue: {
                leadSchoolId: lead.id,
                methodType: contact.methodType,
                normalizedValue: contact.normalizedValue,
              },
            },
            create: {
              leadSchoolId: lead.id,
              ...contact,
            },
            update: {
              value: contact.value,
              label: contact.label,
              isPrimary: contact.isPrimary,
              sourceUrl: contact.sourceUrl,
              verificationStatus: contact.verificationStatus,
              notes: contact.notes,
            },
          });
        }
      });

      successRows += 1;
    } catch (error) {
      failedRows += 1;

      errors.push({
        row: rowNumber,
        schoolName: parsed.schoolName,
        error: error instanceof Error ? error.message : "Unknown import error",
      });
    }
  }

  const finalStatus =
    failedRows > 0 ? LeadImportStatus.FAILED : LeadImportStatus.COMPLETED;

  const updatedBatch = await prisma.leadImportBatch.update({
    where: {
      id: importBatch.id,
    },
    data: {
      successRows,
      failedRows,
      skippedRows,
      status: finalStatus,
      errorsJson: errors.slice(0, 300),
    },
  });

  return reply.send({
    success: failedRows === 0,
    message:
      failedRows === 0
        ? "Excel imported successfully"
        : "Excel imported with some errors",
    data: updatedBatch,
    summary: {
      rowsWithContacts,
      rowsWithoutContacts,
      parsedMobileContacts,
      parsedEmailContacts,
    },
    errors: errors.slice(0, 50),
  });
}

export async function exportLeadsToExcel(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const query = request.query as ListQuery;
  const where = buildLeadWhere(query);
  const orderBy = getLeadOrderBy(query);

  const leads = await prisma.leadSchool.findMany({
    where,
    orderBy,
    include: {
      contactMethods: {
        where: {
          methodType: {
            in: [
              ContactMethodType.MOBILE,
              ContactMethodType.WHATSAPP,
              ContactMethodType.EMAIL,
            ],
          },
        },
        orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
      },
    },
  });

  const exportRows = leads.map((lead, index) => {
    const mobiles = Array.from(
      new Set(
        [
          lead.primaryMobile,
          lead.primaryWhatsapp,
          ...lead.contactMethods
            .filter(
              (contact) =>
                contact.methodType === ContactMethodType.MOBILE ||
                contact.methodType === ContactMethodType.WHATSAPP
            )
            .map((contact) => contact.value),
        ]
          .map((value) => toText(value))
          .filter(Boolean) as string[]
      )
    );

    const emails = Array.from(
      new Set(
        [
          lead.primaryEmail,
          ...lead.contactMethods
            .filter((contact) => contact.methodType === ContactMethodType.EMAIL)
            .map((contact) => contact.value),
        ]
          .map((value) => toText(value))
          .filter(Boolean) as string[]
      )
    );

    return {
      "Sr. No.": index + 1,
      "School Name": lead.schoolName,
      State: lead.state || "",
      City: lead.city || "",
      "School Type": lead.schoolType || "",
      Board: lead.board || "",
      Status: lead.status,
      Priority: lead.priority,
      Source: lead.source,
      "Primary Mobile": lead.primaryMobile || "",
      "Primary WhatsApp": lead.primaryWhatsapp || "",
      "Primary Email": lead.primaryEmail || "",
      "All Mobile Numbers": mobiles.join(", "),
      "All Emails": emails.join(", "),
      "Verification Status": lead.verificationStatus || "",
      "Contact Notes": lead.contactNotes || "",
      "Manual Search Link": lead.manualSearchLink || "",
      "Created At": lead.createdAt,
      "Updated At": lead.updatedAt,
    };
  });

  const exportWorkbook = XLSX.utils.book_new();
  const exportWorksheet = XLSX.utils.json_to_sheet(exportRows);

  exportWorksheet["!cols"] = [
    { wch: 8 },
    { wch: 48 },
    { wch: 20 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 12 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 32 },
    { wch: 44 },
    { wch: 48 },
    { wch: 28 },
    { wch: 50 },
    { wch: 55 },
    { wch: 22 },
    { wch: 22 },
  ];

  XLSX.utils.book_append_sheet(exportWorkbook, exportWorksheet, "Lead Contacts");

  const exportBuffer = XLSX.write(exportWorkbook, {
    bookType: "xlsx",
    type: "buffer",
  });

  const filename = `lead_contacts_${new Date()
    .toISOString()
    .slice(0, 10)}.xlsx`;

  return reply
    .header(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    .header("Content-Disposition", `attachment; filename="${filename}"`)
    .send(exportBuffer);
}