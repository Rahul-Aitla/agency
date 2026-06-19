import { RoutingResult, DesignRequest } from './types';

export function route(req: DesignRequest): RoutingResult {
  const team: Record<string, { email: string; keywords: string[] }> = {
    Priya: {
      email: process.env.PRIYA_EMAIL || 'priya@agency.com',
      keywords: ['logo', 'brand identity', 'style guide', 'brand guidelines', 'branding', 'visual identity'],
    },
    Riya: {
      email: process.env.RIYA_EMAIL || 'riya@agency.com',
      keywords: ['social media', 'marketing', 'instagram', 'facebook', 'linkedin', 'post', 'ad', 'campaign', 'social'],
    },
    Sameer: {
      email: process.env.SAMEER_EMAIL || 'sameer@agency.com',
      keywords: ['deck', 'presentation', 'powerpoint', 'slides', 'pitch deck', 'keynote'],
    },
  };

  const text = [req.what, req.purpose, req.originalMessage].filter(Boolean).join(' ').toLowerCase();

  for (const [name, config] of Object.entries(team)) {
    for (const keyword of config.keywords) {
      if (text.includes(keyword)) {
        return { name, email: config.email, reason: `Matched keyword: "${keyword}"` };
      }
    }
  }

  return { name: 'Priya', email: team.Priya.email, reason: 'Default routing — no specific keyword matched' };
}
