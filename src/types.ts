export interface DesignRequest {
  id: string;
  clientEmail: string;
  clientName: string;
  originalMessage: string;
  what: string | null;
  purpose: string | null;
  deadline: string | null;
  brandReferences: string | null;
  budgetRange: string | null;
  missingFields: string[];
  status: 'pending_info' | 'ready' | 'routed';
  threadId?: string;
  assignedTo?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ParsedEmail {
  clientName: string;
  what: string | null;
  purpose: string | null;
  deadline: string | null;
  brandReferences: string | null;
  budgetRange: string | null;
}

export interface InboundEmailPayload {
  from: string;
  subject: string;
  text: string;
  html?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
  threadId?: string;
}

export interface RoutingResult {
  name: string;
  email: string;
  reason: string;
}
