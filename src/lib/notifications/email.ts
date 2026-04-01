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

function emailLayout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#1a1a2e;padding:24px 32px;">
              <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">Zimark</span>
              <span style="color:#8b8fa3;font-size:14px;margin-left:8px;">IT Support</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">This is an automated message from Zimark IT Support. Please do not reply directly to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ticketLink(portalUrl: string, label?: string): string {
  return `<a href="${portalUrl}" style="display:inline-block;padding:10px 20px;background-color:#1a1a2e;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;margin-top:16px;">${label || "View Ticket"}</a>`;
}

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
        <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Your request has been received</h2>
        <p style="margin:0 0 8px;font-size:14px;color:#6b7280;"><strong>Ticket:</strong> ${ticketNumber}</p>
        <p style="margin:0 0 16px;font-size:14px;color:#6b7280;"><strong>Subject:</strong> ${title}</p>
        <p style="margin:0 0 24px;font-size:14px;color:#374151;">Thank you for submitting your request. Our IT team has received your ticket and will review it shortly. You will be notified of any updates.</p>
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
        <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Your request has been assigned</h2>
        <p style="margin:0 0 8px;font-size:14px;color:#6b7280;"><strong>Ticket:</strong> ${ticketNumber}</p>
        <p style="margin:0 0 8px;font-size:14px;color:#6b7280;"><strong>Subject:</strong> ${title}</p>
        <p style="margin:0 0 16px;font-size:14px;color:#6b7280;"><strong>Assigned to:</strong> ${assigneeName}</p>
        <p style="margin:0 0 8px;font-size:14px;color:#374151;">Your request has been assigned to <strong>${assigneeName}</strong>, who will be looking into it.</p>
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
        <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">New Ticket Assigned to You</h2>
        <p style="margin:0 0 8px;font-size:14px;color:#374151;">Hi ${assigneeName},</p>
        <p style="margin:0 0 16px;font-size:14px;color:#374151;">A new ticket has been assigned to you:</p>
        <p style="margin:0 0 8px;font-size:14px;color:#6b7280;"><strong>Ticket:</strong> ${ticketNumber}</p>
        <p style="margin:0 0 8px;font-size:14px;color:#6b7280;"><strong>Subject:</strong> ${title}</p>
        <p style="margin:0 0 16px;font-size:14px;color:#6b7280;"><strong>Requested by:</strong> ${requesterName}</p>
        <p style="margin:0 0 24px;font-size:14px;color:#374151;">Please review and respond to this ticket.</p>
        <a href="${portalUrl}" style="display:inline-block;background:#1a1a2e;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;">View Ticket</a>
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
        <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Approval needed</h2>
        <p style="margin:0 0 8px;font-size:14px;color:#374151;">Hi ${approverName},</p>
        <p style="margin:0 0 16px;font-size:14px;color:#374151;">A request requires your approval:</p>
        <p style="margin:0 0 8px;font-size:14px;color:#6b7280;"><strong>Ticket:</strong> ${ticketNumber}</p>
        <p style="margin:0 0 8px;font-size:14px;color:#6b7280;"><strong>Subject:</strong> ${title}</p>
        <p style="margin:0 0 16px;font-size:14px;color:#6b7280;"><strong>Requested by:</strong> ${requesterName}</p>
        <p style="margin:0 0 24px;font-size:14px;color:#374151;">Please review and approve or reject this request.</p>
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
        <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Your request has been <span style="color:${decisionColor};">${decisionLabel}</span></h2>
        <p style="margin:0 0 8px;font-size:14px;color:#6b7280;"><strong>Ticket:</strong> ${ticketNumber}</p>
        <p style="margin:0 0 8px;font-size:14px;color:#6b7280;"><strong>Subject:</strong> ${title}</p>
        <p style="margin:0 0 16px;font-size:14px;color:#6b7280;"><strong>Decided by:</strong> ${approverName}</p>
        <p style="margin:0 0 8px;font-size:14px;color:#374151;">Your request has been <strong style="color:${decisionColor};">${decisionLabel}</strong> by ${approverName}.</p>
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
        <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">New update on your request</h2>
        <p style="margin:0 0 8px;font-size:14px;color:#6b7280;"><strong>Ticket:</strong> ${ticketNumber}</p>
        <p style="margin:0 0 16px;font-size:14px;color:#6b7280;"><strong>Subject:</strong> ${title}</p>
        <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>${commenterName}</strong> posted an update:</p>
        <div style="margin:16px 0;padding:16px;background-color:#f9fafb;border-left:3px solid #1a1a2e;border-radius:4px;">
          <p style="margin:0;font-size:14px;color:#374151;white-space:pre-wrap;">${commentBody}</p>
        </div>
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
        <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Your request has been resolved</h2>
        <p style="margin:0 0 8px;font-size:14px;color:#6b7280;"><strong>Ticket:</strong> ${ticketNumber}</p>
        <p style="margin:0 0 16px;font-size:14px;color:#6b7280;"><strong>Subject:</strong> ${title}</p>
        <p style="margin:0 0 8px;font-size:14px;color:#374151;">Your request has been resolved by our IT team. If you have any further questions or if the issue persists, please reply to your original ticket or submit a new request.</p>
      `),
    });
  } catch (error) {
    console.error(`Failed to send ticket resolved email for ${ticketNumber}:`, error);
  }
}
