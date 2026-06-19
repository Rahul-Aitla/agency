# Agency Automation Bot

Automated design request triage for creative agencies. Reads client emails, extracts requirements using AI, requests missing info, and routes complete requests to the right team member.

## How It Works

Every design request needs 5 things before work can start:

1. **What** — what the client wants designed (logo, social post, deck)
2. **Purpose** — what it's for (new brand, campaign, investor meeting)
3. **Deadline** — when they need it
4. **Brand References** — style preferences, brand guidelines
5. **Budget Range** — how much they're looking to spend

The system automates the entire intake process:

- **Parses** incoming emails using Groq AI (LLaMA 3.3-70b)
- **Detects** which of the 5 fields are present vs missing
- **Replies** asking for exactly what's missing
- **Routes** completed requests based on keywords:

| Person | Owns | Keywords |
|---|---|---|
| Priya | Brand identity (logos, style guides) | logo, brand identity, branding |
| Riya | Social media & marketing | social media, instagram, campaign, ad |
| Sameer | Decks & presentations | deck, presentation, slides, powerpoint |

## Tech Stack

- **Runtime:** Node.js + TypeScript (tsx)
- **Server:** Express
- **AI Parsing:** Groq SDK (llama-3.3-70b-versatile) with keyword fallback
- **Email:** Nodemailer (Gmail SMTP)
- **Storage:** SQLite (better-sqlite3)
- **Tunnel:** ngrok (for local dev webhooks)

## Quick Start

```bash
# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your Groq API key and SMTP credentials

# Start the server
npm run dev
```

Then open:
- **Demo form:** `http://localhost:3000/demo`
- **Dashboard:** `http://localhost:3000/`
- **Webhook:** `POST http://localhost:3000/webhook/email`

## API Endpoints

### `POST /webhook/email`
Accepts inbound emails from Gmail Apps Script or n8n. Full pipeline: parse → check → reply → route.

### `POST /api/submit`
Simplified submission from the demo form. Accepts `{ email, subject, message }`.

### `GET /api/requests`
Dashboard data — all requests with stats.

### `GET /api/requests/:id`
Single request details.

### `POST /debug`
Echoes back the raw request body for troubleshooting n8n/GAS payloads.

## Integrations

### n8n.cloud (recommended)
Replace Google Apps Script with a Gmail Trigger → HTTP Request workflow. Send POST with JSON body:
```json
{
  "from": "{{ $json.from.email }}",
  "subject": "{{ $json.subject }}",
  "body": "={{ $json.textPlain || $json.textHtml || $json.snippet }}",
  "messageId": "{{ $json.id }}",
  "threadId": "{{ $json.threadId }}"
}
```

### Google Apps Script
See `google-apps-script.js` — polls Gmail every 5 minutes and forwards labeled emails to the webhook.

## Project Structure

```
src/
├── index.ts          Express server, routes, email processing
├── parser.ts         AI + fallback keyword parsing
├── router.ts         Keyword-based team routing
├── email.ts          Nodemailer email sending
├── storage.ts        SQLite persistence layer
├── types.ts          TypeScript interfaces
├── form.html         Interactive demo form UI
├── dashboard.html    Request tracking dashboard
├── tunnel.ts         ngrok tunnel manager
├── demo.ts           (optional: demo scripts)
```

## Environment Variables

See `.env.example` for all options. Required:
- `GROQ_API_KEY` — Groq API key for AI parsing
- `SMTP_USER` / `SMTP_PASS` — Gmail SMTP credentials for replying to clients
