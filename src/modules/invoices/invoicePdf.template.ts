type RenderInvoiceHtmlArgs = {
  invoice: any;
  company: any;
  logoDataUri?: string | null;
  bankQrDataUri?: string | null;
};

function esc(value: any) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function nl2br(value: any) {
  return esc(value).replaceAll("\n", "<br/>");
}

function formatCurrency(value: any) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: any) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function buildAddressLines(parts1: any[], parts2: any[]) {
  const line1 = parts1.filter(Boolean).map(esc).join(", ");
  const line2 = parts2.filter(Boolean).map(esc).join(", ");

  return [line1, line2].filter(Boolean).join("<br/>");
}

function addressBlock(company: any) {
  return buildAddressLines(
    [company.addressLine1, company.addressLine2],
    [company.city, company.state, company.pincode, company.country]
  );
}

function clientAddressBlock(client: any) {
  return buildAddressLines(
    [client.address],
    [client.city, client.state, client.country]
  );
}

function getStatusColors(status: string) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "paid") {
    return {
      bg: "#dcfce7",
      text: "#166534",
      border: "#86efac",
    };
  }

  if (normalized === "overdue") {
    return {
      bg: "#fee2e2",
      text: "#991b1b",
      border: "#fca5a5",
    };
  }

  if (normalized === "partial") {
    return {
      bg: "#fef3c7",
      text: "#92400e",
      border: "#fcd34d",
    };
  }

  return {
    bg: "#e0e7ff",
    text: "#3730a3",
    border: "#a5b4fc",
  };
}

function deriveInvoiceStatus(invoice: any) {
  const totalAmount = Number(invoice?.totalAmount || 0);
  const paidAmount = Number(invoice?.paidAmount || 0);
  const balanceAmount = Number(invoice?.balanceAmount || 0);
  const storedStatus = String(invoice?.status || "").toLowerCase();

  if (totalAmount > 0 && paidAmount >= totalAmount) {
    return "paid";
  }

  if (paidAmount > 0 && balanceAmount > 0) {
    return "partial";
  }

  if (storedStatus === "overdue") {
    return "overdue";
  }

  return "unpaid";
}

function detailRow(label: string, value: any) {
  if (value === undefined || value === null || value === "") return "";

  return `
    <div class="detail-row">
      <div class="detail-label">${esc(label)}</div>
      <div class="detail-value">${esc(value)}</div>
    </div>
  `;
}

function detailRowHtml(label: string, value: string) {
  if (!value) return "";

  return `
    <div class="detail-row">
      <div class="detail-label">${esc(label)}</div>
      <div class="detail-value">${value}</div>
    </div>
  `;
}

function paymentInfoRows(company: any) {
  const rows = [
    detailRow("Bank Name", company.bankName),
    detailRow("Account Holder", company.bankAccountName),
    detailRow("Account Number", company.bankAccountNumber),
    detailRow("IFSC Code", company.ifscCode),
    detailRow("UPI ID", company.upiId),
  ].filter(Boolean);

  if (!rows.length) {
    return `<div class="empty-state">Payment details are not available at the moment.</div>`;
  }

  return rows.join("");
}

export function renderInvoicePdfHtml({
  invoice,
  company,
  logoDataUri,
  bankQrDataUri,
}: RenderInvoiceHtmlArgs) {
  const primary = company.primaryColor || "#1D4ED8";
  const secondary = company.secondaryColor || "#0F172A";
  const softPrimary = `${primary}14`;

  const derivedStatus = deriveInvoiceStatus(invoice);
  const status = derivedStatus.toUpperCase();
  const statusColors = getStatusColors(derivedStatus);

  const client = invoice.client || {};
  const subscription = invoice.subscription || {};

  const totalAmount = Number(invoice.totalAmount || 0);
  const paidAmount = Number(invoice.paidAmount || 0);
  const balanceAmount = Number(invoice.balanceAmount || 0);

  const period =
    invoice.billingPeriodFrom || invoice.billingPeriodTo
      ? `${formatDate(invoice.billingPeriodFrom)} - ${formatDate(
          invoice.billingPeriodTo
        )}`
      : "-";

  const invoiceTitle = company.gstin ? "TAX INVOICE" : "INVOICE";

  const billToRows = [
    detailRow("Client", client.clientName || client.name || "Client"),
    client.contactPerson ? detailRow("Contact", client.contactPerson) : "",
    detailRowHtml("Address", clientAddressBlock(client) || "Address not available"),
    client.phone ? detailRow("Phone", client.phone) : "",
    client.email ? detailRow("Email", client.email) : "",
    client.gstin ? detailRow("GSTIN", client.gstin) : "",
  ]
    .filter(Boolean)
    .join("");

  const invoiceDetailRows = [
    detailRow("Invoice Date", formatDate(invoice.invoiceDate)),
    detailRow("Due Date", formatDate(invoice.dueDate)),
    detailRow("Billing Period", period),
    detailRow("Billing Cycle", subscription.billingCycle || "-"),
    detailRow("Service", subscription.serviceName || "Service Charges"),
  ]
    .filter(Boolean)
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${esc(invoice.invoiceNo || "Invoice")}</title>
  <style>
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #111827;
      background: #ffffff;
      font-size: 10.8px;
      line-height: 1.28;
    }

    .page {
      padding: 14px 16px 12px;
    }

    .top-strip {
      height: 5px;
      background: linear-gradient(90deg, ${primary}, ${secondary});
      border-radius: 999px;
      margin-bottom: 10px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 14px;
      padding-bottom: 10px;
      border-bottom: 1px solid #e5e7eb;
    }

    .brand {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      max-width: 69%;
    }

    .logo-wrap {
      width: 92px;
      height: 92px;
      border: 1px solid #dbe5ef;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      background: #ffffff;
      flex-shrink: 0;
      padding: 8px;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
    }

    .logo-wrap img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    .logo-fallback {
      font-size: 28px;
      font-weight: 900;
      color: ${primary};
    }

    .company-name {
      font-size: 22px;
      font-weight: 900;
      color: ${secondary};
      margin-bottom: 2px;
      line-height: 1.06;
    }

    .company-subtitle {
      font-size: 9.5px;
      color: #6b7280;
      font-weight: 700;
      margin-bottom: 5px;
      text-transform: uppercase;
      letter-spacing: 0.55px;
    }

    .company-meta {
      color: #475569;
      max-width: 400px;
      font-size: 10px;
      line-height: 1.2;
    }

    .invoice-box {
      min-width: 210px;
      text-align: right;
    }

    .invoice-title {
      font-size: 26px;
      font-weight: 900;
      color: ${secondary};
      letter-spacing: 0.8px;
      line-height: 1;
    }

    .invoice-no {
      margin-top: 5px;
      font-size: 13px;
      font-weight: 800;
      color: ${primary};
    }

    .status {
      display: inline-block;
      margin-top: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      background: ${statusColors.bg};
      color: ${statusColors.text};
      border: 1px solid ${statusColors.border};
      font-weight: 800;
      font-size: 9.5px;
      letter-spacing: 0.4px;
    }

    .top-info-grid {
      display: grid;
      grid-template-columns: 1.05fr 0.95fr;
      gap: 10px;
      margin-top: 10px;
    }

    .section-card {
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      background: #ffffff;
      page-break-inside: avoid;
      overflow: hidden;
    }

    .section-head {
      padding: 8px 12px;
      border-bottom: 1px solid #e5e7eb;
      background: linear-gradient(180deg, #ffffff, #f8fafc);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.65px;
      font-weight: 800;
      color: ${primary};
    }

    .section-body {
      padding: 6px 12px;
    }

    .invoice-details-card .section-head,
    .bank-details-card .section-head {
      background: linear-gradient(180deg, #ffffff, #f8fbff);
    }

    .detail-row {
      display: grid;
      grid-template-columns: 122px minmax(0, 1fr);
      gap: 10px;
      padding: 5px 0;
      border-bottom: 1px dashed #e5e7eb;
      align-items: start;
    }

    .detail-row:last-child {
      border-bottom: none;
    }

    .detail-label {
      color: #64748b;
      font-weight: 700;
      font-size: 10.4px;
      line-height: 1.18;
    }

    .detail-value {
      color: #0f172a;
      font-weight: 800;
      font-size: 10.8px;
      line-height: 1.2;
      word-break: break-word;
    }

    .table-wrap {
      margin-top: 10px;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      overflow: hidden;
      page-break-inside: avoid;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    thead th {
      background: ${secondary};
      color: #ffffff;
      text-align: left;
      padding: 9px 10px;
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }

    tbody td {
      padding: 9px 10px;
      border-bottom: 1px solid #e5e7eb;
      vertical-align: top;
      background: #ffffff;
      font-size: 10.2px;
      line-height: 1.18;
    }

    tbody tr:last-child td {
      border-bottom: none;
    }

    .text-right {
      text-align: right;
    }

    .service-title {
      font-weight: 900;
      color: #111827;
      margin-bottom: 3px;
      font-size: 11px;
    }

    .service-desc {
      color: #6b7280;
      font-size: 9.5px;
      line-height: 1.18;
    }

    .lower-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 270px;
      gap: 12px;
      margin-top: 10px;
      align-items: start;
    }

    .left-stack {
      display: grid;
      gap: 10px;
    }

    .right-stack {
      display: grid;
      gap: 10px;
    }

    .bank-details-card .section-body {
      padding: 8px 12px 8px;
    }

    .bank-details-card .detail-label {
      font-size: 10.6px;
    }

    .bank-details-card .detail-value {
      font-size: 11.2px;
      font-weight: 800;
    }

    .instruction-box {
      margin-top: 8px;
      padding: 8px 10px;
      border-radius: 10px;
      background: ${softPrimary};
      border: 1px solid #dbeafe;
      color: #334155;
      font-size: 10px;
      line-height: 1.24;
    }

    .instruction-box strong {
      color: ${secondary};
    }

    .qr-card .section-body {
      padding: 10px 10px 8px;
      text-align: center;
    }

    .qr-box {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 150px;
    }

    .qr-box img {
      width: 100%;
      height: auto;
      max-width: 150px;
      max-height: 150px;
      object-fit: contain;
      display: block;
      margin: 0 auto;
    }

    .qr-note {
      margin-top: 6px;
      font-size: 9.8px;
      color: #64748b;
      line-height: 1.2;
      word-break: break-word;
    }

    .totals {
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      overflow: hidden;
      background: #ffffff;
      page-break-inside: avoid;
    }

    .totals-head {
      background: linear-gradient(90deg, ${secondary}, ${primary});
      color: #ffffff;
      padding: 9px 11px;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 8px 11px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 10px;
      line-height: 1.15;
    }

    .total-row:last-child {
      border-bottom: none;
    }

    .total-label {
      color: #475569;
      font-weight: 700;
    }

    .total-value {
      color: #111827;
      font-weight: 800;
      text-align: right;
    }

    .grand {
      background: ${primary};
    }

    .grand .total-label,
    .grand .total-value {
      color: #ffffff;
      font-weight: 900;
      font-size: 12px;
    }

    .notes-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 10px;
    }

    .notes-card {
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      background: #ffffff;
      overflow: hidden;
      page-break-inside: avoid;
    }

    .notes-body {
      padding: 8px 12px;
      color: #475569;
      font-size: 9.8px;
      line-height: 1.2;
      min-height: 38px;
    }

    .footer {
      margin-top: 10px;
      text-align: center;
      color: #6b7280;
      font-size: 9px;
      border-top: 1px solid #e5e7eb;
      padding-top: 7px;
      line-height: 1.18;
    }

    .empty-state {
      color: #6b7280;
      font-size: 9.8px;
      line-height: 1.2;
      padding: 6px 0;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="top-strip"></div>

    <div class="header">
      <div class="brand">
        <div class="logo-wrap">
          ${
            logoDataUri
              ? `<img src="${logoDataUri}" alt="Company Logo" />`
              : `<div class="logo-fallback">${esc(
                  String(company.companyName || "E").charAt(0)
                )}</div>`
          }
        </div>

        <div>
          <div class="company-name">${esc(company.companyName || "Edubridge ERP")}</div>
          ${
            company.legalName && company.legalName !== company.companyName
              ? `<div class="company-subtitle">${esc(company.legalName)}</div>`
              : `<div class="company-subtitle">Business Billing Document</div>`
          }

          <div class="company-meta">
            ${addressBlock(company) || "Address not available"}
            ${company.phone ? `<br/>Phone: ${esc(company.phone)}` : ""}
            ${company.email ? `<br/>Email: ${esc(company.email)}` : ""}
            ${company.website ? `<br/>Website: ${esc(company.website)}` : ""}
            ${company.gstin ? `<br/>GSTIN: ${esc(company.gstin)}` : ""}
            ${company.pan ? `<br/>PAN: ${esc(company.pan)}` : ""}
          </div>
        </div>
      </div>

      <div class="invoice-box">
        <div class="invoice-title">${invoiceTitle}</div>
        <div class="invoice-no">${esc(invoice.invoiceNo || "-")}</div>
        <div class="status">${esc(status)}</div>
      </div>
    </div>

    <div class="top-info-grid">
      <div class="section-card">
        <div class="section-head">Bill To</div>
        <div class="section-body">
          ${billToRows}
        </div>
      </div>

      <div class="section-card invoice-details-card">
        <div class="section-head">Invoice Details</div>
        <div class="section-body">
          ${invoiceDetailRows}
        </div>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width: 44%;">Description</th>
            <th style="width: 20%;">Period</th>
            <th class="text-right" style="width: 12%;">Amount</th>
            <th class="text-right" style="width: 12%;">GST</th>
            <th class="text-right" style="width: 12%;">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div class="service-title">${esc(
                subscription.serviceName || "Service Charges"
              )}</div>
              <div class="service-desc">${esc(
                invoice.notes || "Subscription / service billing as per agreed plan."
              )}</div>
            </td>
            <td>${esc(period)}</td>
            <td class="text-right">${formatCurrency(invoice.subtotal)}</td>
            <td class="text-right">
              ${esc(invoice.gstPercent ?? 0)}%<br/>
              ${formatCurrency(invoice.gstAmount)}
            </td>
            <td class="text-right">${formatCurrency(totalAmount)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="lower-grid">
      <div class="left-stack">
        <div class="section-card bank-details-card">
          <div class="section-head">Bank Details</div>
          <div class="section-body">
            ${paymentInfoRows(company)}

            ${
              company.paymentInstructions
                ? `<div class="instruction-box">
                    <strong>Payment Instructions:</strong><br/>
                    ${nl2br(company.paymentInstructions)}
                  </div>`
                : ""
            }
          </div>
        </div>
      </div>

      <div class="right-stack">
        <div class="section-card qr-card">
          <div class="section-head">Scan to Pay</div>
          <div class="section-body">
            <div class="qr-box">
              ${
                bankQrDataUri
                  ? `<img src="${bankQrDataUri}" alt="Payment QR Code" />`
                  : `<div class="empty-state">QR code not available</div>`
              }
            </div>
            ${
              company.upiId
                ? `<div class="qr-note">${esc(company.upiId)}</div>`
                : `<div class="qr-note">Use the bank details to complete payment.</div>`
            }
          </div>
        </div>

        <div class="totals">
          <div class="totals-head">Invoice Summary</div>

          <div class="total-row">
            <span class="total-label">Subtotal</span>
            <span class="total-value">${formatCurrency(invoice.subtotal)}</span>
          </div>
          <div class="total-row">
            <span class="total-label">GST Amount</span>
            <span class="total-value">${formatCurrency(invoice.gstAmount)}</span>
          </div>
          <div class="total-row grand">
            <span class="total-label">Grand Total</span>
            <span class="total-value">${formatCurrency(totalAmount)}</span>
          </div>
          ${
            paidAmount > 0
              ? `<div class="total-row">
                  <span class="total-label">Paid Amount</span>
                  <span class="total-value">${formatCurrency(paidAmount)}</span>
                </div>`
              : ""
          }
          ${
            balanceAmount > 0
              ? `<div class="total-row">
                  <span class="total-label">Balance Amount</span>
                  <span class="total-value">${formatCurrency(balanceAmount)}</span>
                </div>`
              : ""
          }
        </div>
      </div>
    </div>

    <div class="notes-grid">
      ${
        company.termsAndConditions
          ? `<div class="notes-card">
              <div class="section-head">Terms & Conditions</div>
              <div class="notes-body">${nl2br(company.termsAndConditions)}</div>
            </div>`
          : ""
      }

      ${
        company.footerNote || invoice.notes
          ? `<div class="notes-card">
              <div class="section-head">Notes</div>
              <div class="notes-body">
                ${
                  company.footerNote
                    ? nl2br(company.footerNote)
                    : "Thank you for your business."
                }
              </div>
            </div>`
          : ""
      }
    </div>

    <div class="footer">
      ${esc(company.footerNote || "This is a system generated invoice.")}
      <br/>
      ${esc(company.companyName || "Edubridge ERP")}
      ${company.website ? ` • ${esc(company.website)}` : ""}
    </div>
  </div>
</body>
</html>`;
}