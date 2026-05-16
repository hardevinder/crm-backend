import type {
  LeadCampaignRecipientStatus,
  LeadCampaignStatus,
  LeadPriority,
  LeadStatus,
  WhatsappTemplateStatus,
} from "@prisma/client";

export type CampaignListQuery = {
  page?: string;
  limit?: string;
  status?: LeadCampaignStatus;
  search?: string;
  sortBy?: "createdAt" | "updatedAt" | "scheduledAt" | "title";
  sortOrder?: "asc" | "desc";
};

export type CampaignRecipientQuery = {
  page?: string;
  limit?: string;
  status?: LeadCampaignRecipientStatus;
};

export type CampaignLeadFilter = {
  search?: string;
  state?: string;
  city?: string;
  board?: string;
  status?: LeadStatus | string;
  priority?: LeadPriority | string;
  hasMobile?: boolean | string;
  hasWhatsapp?: boolean | string;
};

export type CreateCampaignBody = {
  title?: string;
  description?: string;
  templateId?: number | string;
  templateName?: string;
  languageCode?: string;
  targetFilters?: CampaignLeadFilter;
  leadIds?: Array<number | string>;
  scheduledAt?: string | null;
};

export type UpdateCampaignBody = Partial<CreateCampaignBody> & {
  status?: LeadCampaignStatus;
};

export type PrepareCampaignRecipientsBody = {
  leadIds?: Array<number | string>;
  targetFilters?: CampaignLeadFilter;
  replaceExisting?: boolean;
};

export type SendCampaignBody = {
  limit?: number | string;
  dryRun?: boolean;
  templateVariables?: Record<string, string | number | null | undefined>;
};

export type SendTemplateToLeadBody = {
  leadSchoolId?: number | string;
  phoneNumber?: string;
  templateName?: string;
  languageCode?: string;
  campaignId?: number | string;
  templateVariables?: Record<string, string | number | null | undefined>;
};

export type SendManualReplyBody = {
  /**
   * Preferred when replying to a saved lead.
   */
  leadSchoolId?: number | string;

  /**
   * Alias for leadSchoolId.
   * Useful if frontend sends leadId.
   */
  leadId?: number | string;

  /**
   * Direct WhatsApp/mobile number.
   * Example: 919876543210
   */
  phoneNumber?: string;

  /**
   * Alias for phoneNumber.
   * Useful if frontend sends to.
   */
  to?: string;

  /**
   * Manual text reply message.
   */
  message?: string;

  /**
   * Optional WhatsApp provider message id if replying to a specific inbound message.
   */
  replyToMessageId?: string;

  /**
   * Optional campaign reference.
   */
  campaignId?: number | string;

  /**
   * Optional campaign recipient reference.
   */
  campaignRecipientId?: number | string;
};

export type SyncTemplatesQuery = {
  limit?: string;
};

export type CreateTemplateBody = {
  templateName?: string;
  displayName?: string;
  languageCode?: string;
  category?: string;
  status?: WhatsappTemplateStatus;
  headerText?: string;
  bodyText?: string;
  footerText?: string;
  buttonsJson?: unknown;
  variablesJson?: unknown;
  providerTemplateId?: string;
};

export type MetaTemplateComponent = {
  type?: string;
  format?: string;
  text?: string;
  buttons?: unknown;
  example?: unknown;
};

export type MetaTemplate = {
  id?: string;
  name: string;
  status?: string;
  category?: string;
  language?: string;
  components?: MetaTemplateComponent[];
};

export type WhatsAppWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: {
          display_phone_number?: string;
          phone_number_id?: string;
        };
        contacts?: Array<{
          wa_id?: string;
          profile?: { name?: string };
          user_id?: string;
        }>;
        messages?: Array<Record<string, any>>;
        statuses?: Array<Record<string, any>>;
      };
    }>;
  }>;
};