import type { MetaTemplate } from "./whatsapp-campaign.types.js";

type SendTemplateMessageInput = {
  to: string;
  templateName: string;
  languageCode?: string;
  variables?: Record<string, string | number | null | undefined>;
};

type SendTextMessageInput = {
  to: string;
  body: string;
  previewUrl?: boolean;
  replyToMessageId?: string;
};

type WhatsAppSendResult = {
  raw: any;
  messageId?: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is missing in .env`);
  }

  return value;
}

function getApiErrorMessage(data: any, fallback: string): string {
  return (
    data?.error?.message ||
    data?.error?.error_user_msg ||
    data?.error?.error_data?.details ||
    fallback
  );
}

export function getWhatsAppApiVersion(): string {
  return process.env.WHATSAPP_API_VERSION || "v24.0";
}

export function getWhatsAppPhoneNumberId(): string {
  return requiredEnv("WHATSAPP_PHONE_NUMBER_ID");
}

export function getWhatsAppBusinessAccountId(): string {
  return requiredEnv("WHATSAPP_BUSINESS_ACCOUNT_ID");
}

export function getWhatsAppAccessToken(): string {
  return requiredEnv("WHATSAPP_ACCESS_TOKEN");
}

export function normalizeWhatsAppNumber(value: string): string {
  let phone = String(value || "").replace(/\D+/g, "");

  // Remove leading 00 international prefix if user pasted 0091...
  if (phone.startsWith("00")) {
    phone = phone.slice(2);
  }

  // Remove leading 0 for Indian local numbers like 09417873297
  if (phone.length === 11 && phone.startsWith("0")) {
    phone = phone.slice(1);
  }

  // If plain 10-digit mobile, prefix default country code.
  // For India default is 91.
  if (phone.length === 10) {
    const defaultCountryCode =
      process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || "91";
    phone = `${defaultCountryCode}${phone}`;
  }

  return phone;
}

function buildTemplateComponents(
  variables?: Record<string, string | number | null | undefined>
) {
  if (!variables || Object.keys(variables).length === 0) return undefined;

  const sortedKeys = Object.keys(variables).sort((a, b) => {
    const aNumber = Number(a.replace(/[^0-9]/g, ""));
    const bNumber = Number(b.replace(/[^0-9]/g, ""));

    const aHasNumber = Number.isFinite(aNumber) && /\d/.test(a);
    const bHasNumber = Number.isFinite(bNumber) && /\d/.test(b);

    if (aHasNumber && bHasNumber) {
      return aNumber - bNumber;
    }

    return a.localeCompare(b);
  });

  const parameters = sortedKeys
    .map((key) => variables[key])
    .filter((value) => value !== undefined && value !== null)
    .map((value) => ({
      type: "text",
      text: String(value),
    }));

  if (parameters.length === 0) return undefined;

  return [
    {
      type: "body",
      parameters,
    },
  ];
}

export async function sendTemplateMessage(
  input: SendTemplateMessageInput
): Promise<WhatsAppSendResult> {
  const apiVersion = getWhatsAppApiVersion();
  const phoneNumberId = getWhatsAppPhoneNumberId();
  const accessToken = getWhatsAppAccessToken();

  const components = buildTemplateComponents(input.variables);

  const templatePayload: Record<string, unknown> = {
    name: input.templateName,
    language: {
      code: input.languageCode || "en",
    },
  };

  if (components) {
    templatePayload.components = components;
  }

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: normalizeWhatsAppNumber(input.to),
    type: "template",
    template: templatePayload,
  };

  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const data = (await response.json().catch(() => ({}))) as any;

  if (!response.ok) {
    throw new Error(
      getApiErrorMessage(data, `WhatsApp API failed with ${response.status}`)
    );
  }

  return {
    raw: data,
    messageId: data?.messages?.[0]?.id as string | undefined,
  };
}

export async function sendTextMessage(
  input: SendTextMessageInput
): Promise<WhatsAppSendResult> {
  const apiVersion = getWhatsAppApiVersion();
  const phoneNumberId = getWhatsAppPhoneNumberId();
  const accessToken = getWhatsAppAccessToken();

  const body = String(input.body || "").trim();

  if (!body) {
    throw new Error("WhatsApp text message body is required");
  }

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: normalizeWhatsAppNumber(input.to),
    type: "text",
    text: {
      preview_url: Boolean(input.previewUrl),
      body,
    },
  };

  if (input.replyToMessageId) {
    payload.context = {
      message_id: input.replyToMessageId,
    };
  }

  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const data = (await response.json().catch(() => ({}))) as any;

  if (!response.ok) {
    throw new Error(
      getApiErrorMessage(data, `WhatsApp text send failed with ${response.status}`)
    );
  }

  return {
    raw: data,
    messageId: data?.messages?.[0]?.id as string | undefined,
  };
}

// Alias for readability in webhook auto-reply logic.
export async function sendWhatsAppTextMessage(
  to: string,
  body: string,
  replyToMessageId?: string
): Promise<WhatsAppSendResult> {
  return sendTextMessage({
    to,
    body,
    previewUrl: false,
    replyToMessageId,
  });
}

export async function fetchMetaTemplates(limit = 100): Promise<MetaTemplate[]> {
  const apiVersion = getWhatsAppApiVersion();
  const wabaId = getWhatsAppBusinessAccountId();
  const accessToken = getWhatsAppAccessToken();

  const url = new URL(
    `https://graph.facebook.com/${apiVersion}/${wabaId}/message_templates`
  );

  url.searchParams.set(
    "fields",
    "id,name,status,category,language,components"
  );
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = (await response.json().catch(() => ({}))) as any;

  if (!response.ok) {
    throw new Error(
      getApiErrorMessage(data, `Template fetch failed with ${response.status}`)
    );
  }

  return Array.isArray(data?.data) ? data.data : [];
}
