import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { createRequest, getRequest, updateRequest, getAllRequests, getRequestStats, findByEmail } from './storage';
import { parseEmail, getMissingFields, isComplete } from './parser';
import { sendMissingInfoEmail, sendRoutedEmail, sendInternalNotification } from './email';
import { route } from './router';
import { InboundEmailPayload, DesignRequest, ParsedEmail } from './types';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = parseInt(process.env.PORT || '3000');

async function findExisting(payload: InboundEmailPayload): Promise<DesignRequest | undefined> {
  const all = getAllRequests();
  if (payload.threadId) {
    const found = all.find(r => r.threadId === payload.threadId);
    if (found) return found;
  }
  if (payload.references) {
    const refs = payload.references.split(/\s+/);
    for (const ref of refs) {
      const found = all.find(r => r.threadId === ref);
      if (found) return found;
    }
  }
  if (payload.inReplyTo) {
    const found = all.find(r => r.threadId === payload.inReplyTo);
    if (found) return found;
  }
  const pending = findByEmail(payload.from, 'pending_info');
  if (pending.length > 0) return pending[pending.length - 1];
  return undefined;
}

async function processEmail(payload: InboundEmailPayload): Promise<DesignRequest> {
  const parsed = await parseEmail(payload.text || payload.subject);
  const existing = await findExisting(payload);

  let req: DesignRequest;

  if (existing) {
    req = updateRequest(existing.id, {
      what: parsed.what || existing.what,
      purpose: parsed.purpose || existing.purpose,
      deadline: parsed.deadline || existing.deadline,
      brandReferences: parsed.brandReferences || existing.brandReferences,
      budgetRange: parsed.budgetRange || existing.budgetRange,
      originalMessage: existing.originalMessage + '\n---\n' + (payload.text || ''),
      threadId: payload.threadId || existing.threadId,
      clientName: existing.clientName,
    })!;
    console.log(`[Reply] Updated existing request ${existing.id} from ${payload.from}`);
  } else {
    req = createRequest(payload.from, parsed.clientName, payload.text);
    updateRequest(req.id, {
      what: parsed.what,
      purpose: parsed.purpose,
      deadline: parsed.deadline,
      brandReferences: parsed.brandReferences,
      budgetRange: parsed.budgetRange,
      threadId: payload.threadId || payload.messageId,
    });
    req = getRequest(req.id)!;
  }

  const merged: ParsedEmail = {
    clientName: req.clientName,
    what: req.what,
    purpose: req.purpose,
    deadline: req.deadline,
    brandReferences: req.brandReferences,
    budgetRange: req.budgetRange,
  };

  if (isComplete(merged)) {
    const routing = route(req);
    updateRequest(req.id, { status: 'ready', assignedTo: routing.name });
    const finalReq = getRequest(req.id)!;
    try { await sendRoutedEmail(finalReq, routing.name, routing.email); } catch (e) { console.warn('Email send failed (SMTP not configured):', e); }
    try { await sendInternalNotification(finalReq, routing.name, routing.email); } catch (e) { console.warn('Email send failed (SMTP not configured):', e); }
    updateRequest(req.id, { status: 'routed' });
  } else {
    const missing = getMissingFields(merged);
    updateRequest(req.id, { missingFields: missing });
    const pendingReq = getRequest(req.id)!;
    try { await sendMissingInfoEmail(pendingReq, missing); } catch (e) { console.warn('Email send failed (SMTP not configured):', e); }
  }

  return getRequest(req.id)!;
}

app.post('/webhook/email', async (req, res) => {
  try {
    const rawFrom = req.body.From || req.body.from || req.body.sender;
    const from = typeof rawFrom === 'object' ? (rawFrom.email || rawFrom.name || 'client@unknown.com') : (rawFrom || 'client@unknown.com');

    const payload: InboundEmailPayload = {
      from,
      subject: req.body.Subject || req.body.subject || '',
      text: req.body.body || req.body.text || req.body['stripped-text'] || '',
      html: req.body.html || req.body.textHtml || req.body.bodyHtml,
      messageId: req.body.messageId || req.body['message-id'] || req.body.id,
      threadId: req.body.threadId || req.body['thread-id'],
      inReplyTo: req.body['in-reply-to'] || req.body.inReplyTo,
      references: req.body.references,
    };

    const result = await processEmail(payload);
    res.json({ success: true, requestId: result.id, status: result.status, assignedTo: result.assignedTo });
  } catch (err) {
    console.error('Error processing email:', err);
    res.status(500).json({ error: 'Failed to process email' });
  }
});

app.post('/api/submit', async (req, res) => {
  try {
    const rawFrom = req.body.email || req.body.from || req.body.sender;
    const from = typeof rawFrom === 'object' ? (rawFrom.email || rawFrom.name || 'client@form.com') : (rawFrom || 'client@form.com');

    const payload: InboundEmailPayload = {
      from,
      subject: req.body.subject || '',
      text: req.body.message || req.body.text || req.body.body || '',
      messageId: `form-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };

    const result = await processEmail(payload);
    const routing = result.status === 'routed' ? { assignedTo: result.assignedTo } : null;
    const requestDetails = getRequest(result.id)!;

    res.json({
      success: true,
      requestId: result.id,
      status: result.status,
      parsed: {
        clientName: requestDetails.clientName,
        what: requestDetails.what,
        purpose: requestDetails.purpose,
        deadline: requestDetails.deadline,
        brandReferences: requestDetails.brandReferences,
        budgetRange: requestDetails.budgetRange,
      },
      missingFields: requestDetails.missingFields,
      routing,
    });
  } catch (err) {
    console.error('Error processing submission:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

app.post('/debug', (req, res) => {
  console.log('[Debug] Raw body:', JSON.stringify(req.body, null, 2));
  res.json({ received: req.body });
});

app.get('/api/requests', (req, res) => {
  res.json({ requests: getAllRequests(), stats: getRequestStats() });
});

app.get('/api/requests/:id', (req, res) => {
  const request = getRequest(req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  res.json(request);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'form.html'));
});

async function main() {
  app.listen(PORT, async () => {
    console.log('='.repeat(56));
    console.log(`  Agency automation server running`);
    console.log('='.repeat(56));
    console.log(`  Dashboard:  http://localhost:${PORT}`);
    console.log(`  Demo Form:  http://localhost:${PORT}/demo`);
    console.log(`  Webhook:    POST http://localhost:${PORT}/webhook/email`);
    console.log('='.repeat(56));

    if (process.env.ENABLE_TUNNEL === 'true') {
      try {
        const { startTunnel } = await import('./tunnel');
        const url = await startTunnel(PORT);
        console.log(`  🌍 Public:   ${url}`);
        console.log(`  Webhook:    POST ${url}/webhook/email`);
        console.log('='.repeat(56));
      } catch (err) {
        console.warn(`  ⚠️  Tunnel failed: ${err}`);
      }
    } else {
      console.log(`  To expose this to n8n.cloud, create .env:`);
      console.log(`    ENABLE_TUNNEL=true`);
      console.log(`    NGROK_AUTHTOKEN=<get at https://dashboard.ngrok.com>`);
      console.log('='.repeat(56));
    }
  });
}

main();
