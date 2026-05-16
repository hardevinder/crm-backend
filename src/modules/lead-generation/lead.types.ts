import type { ContactMethodType, LeadPriority, LeadSource, LeadStatus } from "@prisma/client";

export type LeadContactInput = {
  methodType: ContactMethodType;
  value: string;
  label?: string | null;
  isPrimary?: boolean;
  sourceUrl?: string | null;
  verificationStatus?: string | null;
  notes?: string | null;
};

export type CreateLeadBody = {
  schoolName: string;
  schoolType?: string | null;
  schoolCategory?: string | null;
  board?: string | null;
  state?: string | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  website?: string | null;
  status?: LeadStatus;
  priority?: LeadPriority;
  source?: LeadSource;
  sourceLabel?: string | null;
  verificationStatus?: string | null;
  contactNotes?: string | null;
  manualSearchLink?: string | null;
  assignedToUserId?: number | null;
  contactMethods?: LeadContactInput[];
};

export type UpdateLeadBody = Partial<CreateLeadBody> & {
  deletedAt?: never;
};
