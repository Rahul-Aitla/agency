import Database from 'better-sqlite3';
import path from 'path';
import { DesignRequest } from './types';
import { v4 as uuid } from 'uuid';

const dbPath = path.join(__dirname, '..', 'data.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    clientEmail TEXT NOT NULL,
    clientName TEXT NOT NULL DEFAULT 'Client',
    originalMessage TEXT NOT NULL DEFAULT '',
    what TEXT,
    purpose TEXT,
    deadline TEXT,
    brandReferences TEXT,
    budgetRange TEXT,
    missingFields TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending_info',
    threadId TEXT,
    assignedTo TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )
`);

function rowToRequest(row: any): DesignRequest {
  return {
    id: row.id,
    clientEmail: row.clientEmail,
    clientName: row.clientName,
    originalMessage: row.originalMessage,
    what: row.what,
    purpose: row.purpose,
    deadline: row.deadline,
    brandReferences: row.brandReferences,
    budgetRange: row.budgetRange,
    missingFields: JSON.parse(row.missingFields || '[]'),
    status: row.status,
    threadId: row.threadId,
    assignedTo: row.assignedTo,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

export function createRequest(clientEmail: string, clientName: string, message: string): DesignRequest {
  const now = new Date().toISOString();
  const req: DesignRequest = {
    id: uuid(),
    clientEmail,
    clientName,
    originalMessage: message,
    what: null,
    purpose: null,
    deadline: null,
    brandReferences: null,
    budgetRange: null,
    missingFields: [],
    status: 'pending_info',
    createdAt: new Date(now),
    updatedAt: new Date(now),
  };

  db.prepare(`
    INSERT INTO requests (id, clientEmail, clientName, originalMessage, status, missingFields, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, 'pending_info', '[]', ?, ?)
  `).run(req.id, clientEmail, clientName, message, now, now);

  return req;
}

export function getRequest(id: string): DesignRequest | undefined {
  const row = db.prepare('SELECT * FROM requests WHERE id = ?').get(id) as any;
  return row ? rowToRequest(row) : undefined;
}

export function updateRequest(id: string, updates: Partial<DesignRequest>): DesignRequest | undefined {
  const existing = db.prepare('SELECT * FROM requests WHERE id = ?').get(id) as any;
  if (!existing) return undefined;

  const now = new Date().toISOString();
  const merged = { ...existing, ...updates, updatedAt: now };

  if ('missingFields' in updates) {
    merged.missingFields = JSON.stringify(updates.missingFields);
  }

  db.prepare(`
    UPDATE requests SET
      clientName = ?, originalMessage = ?, what = ?, purpose = ?, deadline = ?,
      brandReferences = ?, budgetRange = ?, missingFields = ?, status = ?,
      threadId = ?, assignedTo = ?, updatedAt = ?
    WHERE id = ?
  `).run(
    merged.clientName, merged.originalMessage, merged.what, merged.purpose, merged.deadline,
    merged.brandReferences, merged.budgetRange,
    typeof merged.missingFields === 'string' ? merged.missingFields : JSON.stringify(merged.missingFields),
    merged.status, merged.threadId, merged.assignedTo, now, id
  );

  return rowToRequest(db.prepare('SELECT * FROM requests WHERE id = ?').get(id));
}

export function findByEmail(email: string, status?: DesignRequest['status']): DesignRequest[] {
  const rows = status
    ? db.prepare('SELECT * FROM requests WHERE clientEmail = ? AND status = ?').all(email, status) as any[]
    : db.prepare('SELECT * FROM requests WHERE clientEmail = ?').all(email) as any[];
  return rows.map(rowToRequest);
}

export function getPendingRequests(): DesignRequest[] {
  const rows = db.prepare("SELECT * FROM requests WHERE status = 'pending_info'").all() as any[];
  return rows.map(rowToRequest);
}

export function getReadyRequests(): DesignRequest[] {
  const rows = db.prepare("SELECT * FROM requests WHERE status = 'ready'").all() as any[];
  return rows.map(rowToRequest);
}

export function getAllRequests(): DesignRequest[] {
  const rows = db.prepare('SELECT * FROM requests ORDER BY createdAt DESC').all() as any[];
  return rows.map(rowToRequest);
}

export function getRequestStats(): { total: number; pending: number; ready: number; routed: number } {
  const row = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending_info' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) as ready,
      SUM(CASE WHEN status = 'routed' THEN 1 ELSE 0 END) as routed
    FROM requests
  `).get() as any;
  return {
    total: row.total,
    pending: row.pending,
    ready: row.ready,
    routed: row.routed,
  };
}
