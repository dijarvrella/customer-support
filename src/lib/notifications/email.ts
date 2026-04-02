import { Resend } from "resend";

// Lazy init - only create client when actually sending (avoid build-time errors)
let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}
const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "Zimark IT Support <notifications@zimark.io>";

/** Public site origin for absolute logo URLs in email (same asset as /login). */
function getPublicOrigin(): string {
  const raw =
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "";
  return raw.replace(/\/$/, "");
}

function logoBlock(): string {
  const origin = getPublicOrigin();
  if (!origin) {
    return `<div style="text-align:center;">
      <span style="color:#0f172a;font-size:22px;font-weight:700;letter-spacing:-0.02em;">Zimark</span>
    </div>`;
  }
  const src = `${origin}/zimark-logo.svg`;
  return `<div style="text-align:center;">
    <img src="${src}" alt="Zimark" width="200" style="display:inline-block;margin:0 auto;max-width:220px;height:auto;border:0;outline:none;" />
  </div>`;
}

export function emailLayout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
          <tr>
            <td style="padding:28px 24px 20px;text-align:center;background-color:#ffffff;border-bottom:1px solid #e2e8f0;">
              ${logoBlock()}
              <p style="margin:14px 0 0;font-size:13px;color:#64748b;">IT Service Management</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px;text-align:center;color:#334155;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:22px 28px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.55;">This is an automated message from Zimark IT Support.<br />Please do not reply directly to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function ticketLink(portalUrl: string, label?: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
    <tr>
      <td align="center" style="padding:0;">
        <a href="${portalUrl}" style="display:inline-block;padding:12px 28px;background-color:#0f172a;color:#ffffff !important;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">${label || "View Ticket"}</a>
      </td>
    </tr>
  </table>`;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const H2 = (text: string) =>
  `<h2 style="margin:0 0 18px;font-size:20px;font-weight:700;color:#0f172a;text-align:center;line-height:1.3;">${text}</h2>`;
const P = (html: string, extra = "") =>
  `<p style="margin:0 0 12px;font-size:15px;color:#475569;text-align:center;line-height:1.55;${extra}">${html}</p>`;
const META = (label: string, value: string) =>
  `<p style="margin:0 0 6px;font-size:14px;color:#64748b;text-align:center;line-height:1.5;"><strong style="color:#334155;">${label}</strong> ${value}</p>`;

export async function sendTicketCreatedEmail(
  to: string,
  ticketNumber: string,
  title: string,
  portalUrl: string
): Promise<void> {
  try {
    const client = getResend();
    if (!client) return;
    await client.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Your request ${ticketNumber} has been received`,
      html: emailLayout(`
        ${H2("Your request has been received")}
        ${META("Ticket:", ticketNumber)}
        ${META("Subject:", title)}
        ${P("Thank you for submitting your request. Our IT team has received your ticket and will review it shortly. You will be notified of any updates.", "margin-bottom:8px;")}
        ${ticketLink(portalUrl)}
      `),
    });
  } catch (error) {
    console.error(`Failed to send ticket created email for ${ticketNumber}:`, error);
  }
}

export async function sendTicketAssignedEmail(
  to: string,
  ticketNumber: string,
  title: string,
  assigneeName: string
): Promise<void> {
  try {
    const client = getResend();
    if (!client) return;
    await client.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Your request ${ticketNumber} has been assigned`,
      html: emailLayout(`
        ${H2("Your request has been assigned")}
        ${META("Ticket:", ticketNumber)}
        ${META("Subject:", title)}
        ${META("Assigned to:", assigneeName)}
        ${P(`Your request has been assigned to <strong style="color:#0f172a;">${assigneeName}</strong>, who will be looking into it.`)}
      `),
    });
  } catch (error) {
    console.error(`Failed to send ticket assigned email for ${ticketNumber}:`, error);
  }
}

export async function sendNewAssignmentEmail(
  to: string,
  assigneeName: string,
  ticketNumber: string,
  title: string,
  requesterName: string,
  portalUrl: string
): Promise<void> {
  try {
    const client = getResend();
    if (!client) return;
    const result = await client.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `New ticket assigned to you: ${ticketNumber}`,
      html: emailLayout(`
        ${H2("New ticket assigned to you")}
        ${P(`Hi <strong style="color:#0f172a;">${assigneeName}</strong>,`)}
        ${P("A new ticket has been assigned to you:")}
        ${META("Ticket:", ticketNumber)}
        ${META("Subject:", title)}
        ${META("Requested by:", requesterName)}
        ${P("Please review and respond to this ticket.", "margin-bottom:8px;")}
        ${ticketLink(portalUrl, "View Ticket")}
      `),
    });
    console.log(`Assignment email sent to ${to} for ${ticketNumber}:`, result);
  } catch (error) {
    console.error(`Failed to send assignment email to ${to} for ${ticketNumber}:`, error);
  }
}

export async function sendApprovalRequestEmail(
  to: string,
  approverName: string,
  ticketNumber: string,
  title: string,
  requesterName: string,
  portalUrl: string
): Promise<void> {
  try {
    const client = getResend();
    if (!client) return;
    await client.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Approval needed: ${title} (${ticketNumber})`,
      html: emailLayout(`
        ${H2("Approval needed")}
        ${P(`Hi <strong style="color:#0f172a;">${approverName}</strong>,`)}
        ${P("A request requires your approval:")}
        ${META("Ticket:", ticketNumber)}
        ${META("Subject:", title)}
        ${META("Requested by:", requesterName)}
        ${P("Please review and approve or reject this request.", "margin-bottom:8px;")}
        ${ticketLink(portalUrl, "Review Request")}
      `),
    });
  } catch (error) {
    console.error(`Failed to send approval request email for ${ticketNumber}:`, error);
  }
}

export async function sendApprovalDecisionEmail(
  to: string,
  ticketNumber: string,
  title: string,
  decision: string,
  approverName: string
): Promise<void> {
  try {
    const decisionLabel = decision === "approved" ? "approved" : "rejected";
    const decisionColor = decision === "approved" ? "#059669" : "#dc2626";

    const client = getResend();
    if (!client) return;
    await client.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Your request ${ticketNumber} has been ${decisionLabel}`,
      html: emailLayout(`
        <h2 style="margin:0 0 18px;font-size:20px;font-weight:700;color:#0f172a;text-align:center;line-height:1.3;">Your request has been <span style="color:${decisionColor};">${decisionLabel}</span></h2>
        ${META("Ticket:", ticketNumber)}
        ${META("Subject:", title)}
        ${META("Decided by:", approverName)}
        ${P(`Your request has been <strong style="color:${decisionColor};">${decisionLabel}</strong> by ${approverName}.`)}
      `),
    });
  } catch (error) {
    console.error(`Failed to send approval decision email for ${ticketNumber}:`, error);
  }
}

export async function sendTicketCommentEmail(
  to: string,
  ticketNumber: string,
  title: string,
  commenterName: string,
  commentBody: string
): Promise<void> {
  try {
    const client = getResend();
    if (!client) return;
    await client.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `New update on ${ticketNumber}: ${title}`,
      html: emailLayout(`
        ${H2("New update on your request")}
        ${META("Ticket:", ticketNumber)}
        ${META("Subject:", title)}
        ${P(`<strong style="color:#0f172a;">${commenterName}</strong> posted an update:`)}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 0;">
          <tr>
            <td align="center">
              <div style="max-width:480px;margin:0 auto;padding:16px 18px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;text-align:left;">
                <p style="margin:0;font-size:14px;color:#334155;white-space:pre-wrap;line-height:1.5;">${escapeHtml(commentBody)}</p>
              </div>
            </td>
          </tr>
        </table>
      `),
    });
  } catch (error) {
    console.error(`Failed to send comment email for ${ticketNumber}:`, error);
  }
}

export async function sendTicketResolvedEmail(
  to: string,
  ticketNumber: string,
  title: string
): Promise<void> {
  try {
    const client = getResend();
    if (!client) return;
    await client.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Your request ${ticketNumber} has been resolved`,
      html: emailLayout(`
        ${H2("Your request has been resolved")}
        ${META("Ticket:", ticketNumber)}
        ${META("Subject:", title)}
        ${P("Your request has been resolved by our IT team. If you have any further questions or if the issue persists, please reply to your original ticket or submit a new request.")}
      `),
    });
  } catch (error) {
    console.error(`Failed to send ticket resolved email for ${ticketNumber}:`, error);
  }
}
