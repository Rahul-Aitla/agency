/**
 * Google Apps Script — Gmail → Agency Bot Webhook
 *
 * SETUP:
 * 1. Go to https://script.google.com
 * 2. Create a new project, paste this file
 * 3. Replace WEBHOOK_URL with your ngrok tunnel URL
 * 4. Run `setupTrigger()` once to authorize
 * 5. Inboxes are checked every 5 minutes
 *
 * The script watches for emails labeled "agency-bot" or
 * unread emails from known client addresses, then POSTs
 * them to your webhook.
 */

const WEBHOOK_URL = 'https://unenforceable-participially-altha.ngrok-free.dev/webhook/email';
const LABEL_NAME = 'agency-bot';

/**
 * Sets up the time-based trigger (runs once)
 */
function setupTrigger() {
  ScriptApp.newTrigger('checkInbox')
    .timeBased()
    .everyMinutes(5)
    .create();

  // Create the label if it doesn't exist
  try { GmailApp.createLabel(LABEL_NAME); } catch(e) {}

  console.log('Trigger created. Checking inbox every 5 minutes.');
}

/**
 * Main: check inbox and process new emails
 */
function checkInbox() {
  const threads = GmailApp.search(`label:${LABEL_NAME} is:unread`);

  const seen = new Set();

  for (const thread of threads) {
    const msgs = thread.getMessages();
    for (const msg of msgs) {
      if (!msg.isUnread()) continue;
      const id = msg.getId();
      if (seen.has(id)) continue;
      seen.add(id);

      processMessage(msg);
      msg.markRead();
    }
  }
}

/**
 * Send a single email to the webhook
 */
function processMessage(msg) {
  const payload = {
    from:      msg.getFrom(),
    subject:   msg.getSubject(),
    text:      msg.getPlainBody(),
    html:      msg.getBody(),
    messageId: msg.getId(),
    threadId:  msg.getThread().getId(),
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  try {
    const resp = UrlFetchApp.fetch(WEBHOOK_URL, options);
    const code = resp.getResponseCode();
    if (code === 200) {
      console.log(`✓ Processed: ${msg.getSubject()} (${msg.getFrom()})`);
    } else {
      console.warn(`⚠ HTTP ${code}: ${msg.getSubject()} — ${resp.getContentText()}`);
    }
  } catch (err) {
    console.error(`✗ Failed to send ${msg.getSubject()}: ${err}`);
  }
}

/**
 * Manually test with a sample email
 */
function testWithSample() {
  const sampleEmail = {
    from: 'client@example.com',
    subject: 'New logo for our coffee brand',
    text: 'Hey, we need a logo for our new coffee brand. Something minimal and modern.',
    messageId: 'test-' + Date.now(),
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(sampleEmail),
    muteHttpExceptions: true,
  };

  const resp = UrlFetchApp.fetch(WEBHOOK_URL, options);
  console.log('Test response:', resp.getContentText());
}
