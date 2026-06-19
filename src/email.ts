import { Resend } from 'resend';
import { DesignRequest, ParsedEmail } from './types';

const resend = new Resend(process.env.RESEND_API_KEY || '');

function fromAddress(): string {
  return process.env.RESEND_FROM || '"Agency Bot" <onboarding@resend.dev>';
}

export async function sendMissingInfoEmail(req: DesignRequest, missingFields: string[], parsed: ParsedEmail): Promise<void> {
  let intro = '';
  if (parsed.what && parsed.purpose) {
    intro = `From your message, it sounds like you're looking for a ${parsed.what.toLowerCase()} for ${parsed.purpose.toLowerCase()}.`;
  } else if (parsed.what) {
    intro = `From your message, it sounds like you're looking for a ${parsed.what.toLowerCase()}.`;
  } else {
    intro = `Thanks for reaching out, ${req.clientName}!`;
  }

  const askList = missingFields.map(f => `• ${f}`).join('\n');

  const html = `
    <div style="font-family: sans-serif; max-width: 600px;">
      <p>${intro}</p>
      <p>To prepare an accurate quote and timeline, could you share:</p>
      <ul>
        ${missingFields.map(f => `<li><strong>${f}</strong></li>`).join('')}
      </ul>
      <p>Reply to this email and we'll take it from there!</p>
      <p style="color: #666; font-size: 12px;">Request ID: ${req.id}</p>
    </div>
  `;

  const text = `${intro}\n\nTo prepare an accurate quote and timeline, could you share:\n\n${askList}\n\nReply to this email and we'll take it from there!\n\nRequest ID: ${req.id}`;

  const { data, error } = await resend.emails.send({
    from: fromAddress(),
    to: req.clientEmail,
    subject: 'A few more details needed for your design request',
    text,
    html,
    headers: req.threadId ? { 'References': req.threadId, 'In-Reply-To': req.threadId } : undefined,
  });

  if (error) {
    console.error('[Email] Failed to send "missing info" →', req.clientEmail, error);
  } else {
    console.log(`[Email] Sent "missing info" → ${req.clientEmail} (id: ${data?.id})`);
  }
}

export async function sendRoutedEmail(req: DesignRequest, assigneeName: string, assigneeEmail: string): Promise<void> {
  const summary = Object.entries({
    'What': req.what,
    'Purpose': req.purpose,
    'Deadline': req.deadline,
    'Brand References': req.brandReferences,
    'Budget': req.budgetRange,
  })
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  const html = `
    <div style="font-family: sans-serif; max-width: 600px;">
      <h2>✅ Your request has been received!</h2>
      <p>Thanks, ${req.clientName}! We have all the details we need.</p>
      <p>Your request has been assigned to <strong>${assigneeName}</strong> (${assigneeEmail}), who will work on it.</p>
      <hr/>
      <pre style="background: #f5f5f5; padding: 12px; border-radius: 4px;">${summary}</pre>
      <p style="color: #666; font-size: 12px;">Request ID: ${req.id}</p>
    </div>
  `;

  const text = `✅ Your request has been received!\n\nThanks, ${req.clientName}! We have all the details we need.\n\nYour request has been assigned to ${assigneeName} (${assigneeEmail}), who will work on it.\n\n${summary}\n\nRequest ID: ${req.id}`;

  const { data, error } = await resend.emails.send({
    from: fromAddress(),
    to: req.clientEmail,
    subject: 'Your design request is in progress!',
    text,
    html,
  });

  if (error) {
    console.error('[Email] Failed to send "routed confirmation" →', req.clientEmail, error);
  } else {
    console.log(`[Email] Sent "routed confirmation" → ${req.clientEmail} (id: ${data?.id})`);
  }
}

export async function sendInternalNotification(req: DesignRequest, assigneeName: string, assigneeEmail: string): Promise<void> {
  const summary = Object.entries({
    'What': req.what,
    'Purpose': req.purpose,
    'Deadline': req.deadline,
    'Brand References': req.brandReferences,
    'Budget': req.budgetRange,
    'Client Email': req.clientEmail,
  })
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  const html = `
    <div style="font-family: sans-serif; max-width: 600px;">
      <h2>📬 New design request assigned to you</h2>
      <p><strong>From:</strong> ${req.clientName} (${req.clientEmail})</p>
      <pre style="background: #f5f5f5; padding: 12px; border-radius: 4px;">${summary}</pre>
      <hr/>
      <details>
        <summary>Original message</summary>
        <blockquote style="border-left: 3px solid #ddd; padding-left: 12px; color: #555;">
          ${req.originalMessage}
        </blockquote>
      </details>
      <p style="color: #666; font-size: 12px;">Request ID: ${req.id}</p>
    </div>
  `;

  const text = `📬 New design request assigned to you\n\nFrom: ${req.clientName} (${req.clientEmail})\n\n${summary}\n\nOriginal message:\n${req.originalMessage}\n\nRequest ID: ${req.id}`;

  const { data, error } = await resend.emails.send({
    from: fromAddress(),
    to: assigneeEmail,
    subject: `New design request: ${req.what || 'Design'} for ${req.purpose || 'client'}`,
    text,
    html,
  });

  if (error) {
    console.error('[Email] Failed to send "internal notification" →', assigneeEmail, error);
  } else {
    console.log(`[Email] Sent "internal notification" → ${assigneeEmail} (id: ${data?.id})`);
  }
}
