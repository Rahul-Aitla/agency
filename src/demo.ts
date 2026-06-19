import dotenv from 'dotenv';
dotenv.config();

import { parseEmail, getMissingFields, isComplete } from './parser';
import { route } from './router';
import { createRequest, updateRequest, getRequest } from './storage';

async function main() {
  const clientMessage = `Hey, we need a logo for our new coffee brand. Something minimal and modern. We're thinking earthy tones. Let us know what you need from us!`;

  console.log('='.repeat(60));
  console.log('AGENCY AUTOMATION DEMO');
  console.log('='.repeat(60));

  console.log('\n📨 INCOMING EMAIL:');
  console.log(`From: client@coffeebrand.com`);
  console.log(`Message: "${clientMessage}"\n`);

  console.log('🔍 PARSING EMAIL WITH OPENAI...\n');
  const parsed = await parseEmail(clientMessage);

  console.log('📋 EXTRACTED FIELDS:');
  console.log(`  Client name:     ${parsed.clientName}`);
  console.log(`  What:            ${parsed.what || '❌ MISSING'}`);
  console.log(`  Purpose:         ${parsed.purpose || '❌ MISSING'}`);
  console.log(`  Deadline:        ${parsed.deadline || '❌ MISSING'}`);
  console.log(`  Brand refs:      ${parsed.brandReferences || '❌ MISSING'}`);
  console.log(`  Budget:          ${parsed.budgetRange || '❌ MISSING'}`);

  const missing = getMissingFields(parsed);
  console.log(`\n⚠️  MISSING FIELDS: ${missing.length > 0 ? missing.join(', ') : 'None — all present!'}`);

  const req = createRequest('client@coffeebrand.com', parsed.clientName, clientMessage);
  updateRequest(req.id, {
    what: parsed.what,
    purpose: parsed.purpose,
    deadline: parsed.deadline,
    brandReferences: parsed.brandReferences,
    budgetRange: parsed.budgetRange,
    missingFields: missing,
  });

  if (isComplete(parsed)) {
    const routing = route(getRequest(req.id)!);
    updateRequest(req.id, { status: 'ready', assignedTo: routing.name });

    console.log(`\n✅ REQUEST COMPLETE — Routing to ${routing.name} (${routing.email})`);
    console.log(`   Reason: ${routing.reason}`);
    console.log(`\n📬 Sending confirmation to client@coffeebrand.com`);
    console.log(`📬 Sending internal notification to ${routing.email}`);
  } else {
    console.log(`\n📧 SENDING FOLLOW-UP EMAIL to client@coffeebrand.com`);
    console.log(`   Subject: "A few more details needed for your design request"`);
    console.log(`   Asking for: ${missing.join(', ')}`);

    console.log(`\n⏳ Request stored — waiting for client reply...`);

    // Simulating client reply
    console.log(`\n--- SIMULATING CLIENT REPLY ---`);
    const replyMessage = `Sorry! Deadline is end of next month. Budget is around $1k-$2k.`;

    console.log(`📨 Reply: "${replyMessage}"`);

    const replyParsed = await parseEmail(replyMessage);

    const updatedReq = getRequest(req.id)!;
    updateRequest(req.id, {
      deadline: replyParsed.deadline || (updatedReq.deadline !== null ? updatedReq.deadline : null),
      budgetRange: replyParsed.budgetRange || (updatedReq.budgetRange !== null ? updatedReq.budgetRange : null),
    });

    const finalReq = getRequest(req.id)!;
    const stillMissing = getMissingFields({
      clientName: finalReq.clientName,
      what: finalReq.what,
      purpose: finalReq.purpose,
      deadline: finalReq.deadline,
      brandReferences: finalReq.brandReferences,
      budgetRange: finalReq.budgetRange,
    });

    if (stillMissing.length === 0) {
      const routing = route(finalReq);
      updateRequest(req.id, { status: 'ready', assignedTo: routing.name });
      console.log(`\n✅ ALL FIELDS PRESENT AFTER REPLY!`);
      console.log(`📬 Routing to ${routing.name} (${routing.email})`);
      console.log(`   Reason: ${routing.reason}`);
    } else {
      console.log(`\n⚠️  Still missing: ${stillMissing.join(', ')}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('FINAL REQUEST STATE:');
  console.log(JSON.stringify(getRequest(req.id), null, 2));
}

main().catch(console.error);
