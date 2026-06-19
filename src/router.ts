import { RoutingResult, DesignRequest } from './types';

const team: Record<string, { email: string; keywords: string[] }> = {
  Priya: {
    email: process.env.SMTP_USER || 'priya@agency.com',
    keywords: ['logo', 'brand identity', 'style guide', 'brand guidelines', 'branding', 'visual identity'],
  },
  Riya: {
    email: process.env.SMTP_USER || 'riya@agency.com',
    keywords: ['social media', 'marketing', 'instagram', 'facebook', 'linkedin', 'post', 'ad', 'campaign', 'social'],
  },
  Sameer: {
    email: process.env.SMTP_USER || 'sameer@agency.com',
    keywords: ['deck', 'presentation', 'powerpoint', 'slides', 'pitch deck', 'keynote'],
  },
};

export function route(req: DesignRequest): RoutingResult {
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
