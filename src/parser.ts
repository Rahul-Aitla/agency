import Groq from 'groq-sdk';
import { ParsedEmail } from './types';

let groq: Groq | null = null;
function getGroq(): Groq {
  if (!groq) {
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groq;
}

const requiredFields = ['what', 'purpose', 'deadline', 'brandReferences', 'budgetRange'] as const;

const SYSTEM_PROMPT = `You are a parsing engine for a creative agency's email inbox.
Extract the following fields from the client's email message. If a field is not present or unclear, set it to null.

Fields to extract:
- clientName: The name of the person sending the request
- what: What the client wants designed (e.g., logo, social media post, presentation deck)
- purpose: What it's for (e.g., new coffee brand, marketing campaign, investor meeting)
- deadline: When they need it by (e.g., "next week", "ASAP", "by Friday", specific date)
- brandReferences: Brand guidelines, references, style preferences (e.g., "minimal and modern", "earthy tones")
- budgetRange: Their budget range (e.g., "under $500", "between $1k-$2k")

Return a JSON object with exactly these 6 keys. Use null for any missing field.`;

function keywordParseEmail(text: string): ParsedEmail {
  const lower = text.toLowerCase();

  const clientName = (() => {
    const skipWords = new Set(['hey', 'hi', 'hello', 'we', 'i', 'my', 'our', 'us', 'the', 'a', 'an']);
    const nameMatch = text.match(/(?:this is|from|--)\s+(\w+(?:\s+\w+)?)(?:\s|\.|,|!)/i);
    if (nameMatch && !skipWords.has(nameMatch[1].toLowerCase())) return nameMatch[1];
    const greetingMatch = text.match(/^(?:hey|hi|hello)\s+(\w+)/i);
    if (greetingMatch && !skipWords.has(greetingMatch[1].toLowerCase())) return greetingMatch[1];
    return 'Client';
  })();

  const what = (() => {
    if (lower.includes('logo')) return 'Logo';
    if (lower.includes('post') || lower.includes('social')) return 'Social media post';
    if (lower.includes('deck') || lower.includes('presentation') || lower.includes('slides')) return 'Presentation deck';
    return null;
  })();

  const purpose = (() => {
    const forMatch = text.match(/for (?:our|a|an|my)?\s*(.+?)(?:\.|,|!|$)/i);
    if (forMatch && !forMatch[1].toLowerCase().startsWith('minimal')) return forMatch[1].trim();
    const brandMatch = text.match(/(?:new|our|my)\s+(.+?)\s+(?:brand|company|business|product)/i);
    return brandMatch?.[1]?.trim() || null;
  })();

  const deadline = (() => {
    const patterns = [
      /deadline(?:\s+is)?\s*(.+?)(?:\.|,|!|$)/i,
      /by\s+(?:the\s+)?(end\s+of\s+.+?|next\s+\w+|this\s+\w+|\w+\s+\d+)(?:\s|\.|,|!|$)/i,
      /need\s+it\s+(.+?)(?:\.|,|!|$)/i,
      /due\s+(.+?)(?:\.|,|!|$)/i,
      /\basap\b/i,
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) return m[1] || m[0];
    }
    return null;
  })();

  const brandReferences = (() => {
    const styleMatch = text.match(/(?:something|style|vibe|look|feel|tones?)\s+(.+?)(?:\.|!|,|$)/i);
    if (styleMatch) return styleMatch[1].trim();
    const tonesMatch = text.match(/(.+?)\s+tones?/i);
    if (tonesMatch) return `${tonesMatch[1].trim()} tones`;
    return null;
  })();

  const budgetRange = (() => {
    const patterns = [
      /budget(?:\s+is)?\s*(.+?)(?:\.|,|!|$)/i,
      /\$\s*([\d,]+(?:\s*-\s*\$\s*[\d,]+)?)/i,
      /under\s+\$([\d,]+)/i,
      /between\s+\$([\d,]+)\s*(?:and|to|-)\s*\$([\d,]+)/i,
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) return m[0].trim();
    }
    return null;
  })();

  return { clientName, what, purpose, deadline, brandReferences, budgetRange };
}

export async function parseEmail(text: string): Promise<ParsedEmail> {
  if (!process.env.GROQ_API_KEY) {
    return keywordParseEmail(text);
  }

  try {
    const response = await getGroq().chat.completions.create({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return keywordParseEmail(text);

    const parsed = JSON.parse(content) as ParsedEmail;
    return {
      clientName: parsed.clientName || 'Client',
      what: parsed.what || null,
      purpose: parsed.purpose || null,
      deadline: parsed.deadline || null,
      brandReferences: parsed.brandReferences || null,
      budgetRange: parsed.budgetRange || null,
    };
  } catch (err) {
    console.warn('[Groq] API request failed, falling back to keyword parser:', err);
    return keywordParseEmail(text);
  }
}

export function getMissingFields(parsed: ParsedEmail): string[] {
  const fieldLabels: Record<string, string> = {
    what: 'What you want designed',
    purpose: 'What it\'s for',
    deadline: 'Your deadline',
    brandReferences: 'Brand guidelines or references',
    budgetRange: 'Your budget range',
  };

  return requiredFields
    .filter(key => !parsed[key as keyof ParsedEmail])
    .map(key => fieldLabels[key]);
}

export function isComplete(parsed: ParsedEmail): boolean {
  return getMissingFields(parsed).length === 0;
}
