import type { MetaTemplate } from "./whatsapp-campaign.types.js";

type SendTemplateMessageInput = {
  to: string;
  templateName: string;
  languageCode?: string;
  variables?: Record<string, string | number | null | undefined>;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is missing in .env`);
  }
  return value;
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

function buildTemplateComponents(
  variables?: Record<string, string | number | null | undefined>
) {
  if (!variables || Object.keys(variables).length === 0) return undefined;

  const sortedKeys = Object.keys(variables).sort((a, b) => {
    const aNumber = Number(a.replace(/[^0-9]/g, ""));
    const bNumber = Number(b.replace(/[^0-9]/g, ""));

    if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
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

export async function sendTemplateMessage(input: SendTemplateMessageInput) {
  const apiVersion = getWhatsAppApiVersion();
  const phoneNumberId = getWhatsAppPhoneNumberId();
  const accessToken = getWhatsAppAccessToken();

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: input.to,
    type: "template",
    template: {
      name: input.templateName,
      language: {
        code: input.languageCode || "en",
      },
      components: buildTemplateComponents(input.variables),
    },
  };

  if (!(payload.template as Record<string, unknown>).components) {
    delete (payload.template as Record<string, unknown>).components;
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
    const message =
      data?.error?.message ||
      data?.error?.error_user_msg ||
      `WhatsApp API failed with ${response.status}`;

    throw new Error(message);
  }

  return {
    raw: data,
    messageId: data?.messages?.[0]?.id as string | undefined,
  };
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
    const message = data?.error?.message || `Template fetch failed with ${response.status}`;
    throw new Error(message);
  }

  return Array.isArray(data?.data) ? data.data : [];
}
