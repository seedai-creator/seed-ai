import { randomUUID } from 'node:crypto';

const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const LABEL = /^[A-Za-z0-9_.:-]{1,100}$/;
const identifiers = new Set(['requestId','userId','companyId','conversationId','jobId']);
const labels = new Set(['code','feature','provider','model','status','method','environment','release']);
const numbers = new Set(['durationMs','statusCode','attempt','inputTokens','outputTokens','costUsd','count']);

// Allowlist, rather than serializing Error objects, URLs, documents or request bodies.
export function safeLogFields(fields: Record<string, unknown>) {
  const safe: Record<string, string | number> = {};
  for (const [key,value] of Object.entries(fields)) {
    if (identifiers.has(key) && typeof value === 'string' && ID.test(value)) safe[key]=value;
    else if (labels.has(key) && typeof value === 'string' && LABEL.test(value) && !/^(sk-|sk_|rk_|whsec_|sb_secret_|re_|eyJ)/i.test(value)) safe[key]=value;
    else if (numbers.has(key) && typeof value === 'number' && Number.isFinite(value) && value>=0) safe[key]=value;
  }
  return safe;
}
export function logEvent(event:string, fields:Record<string,unknown>={}, level:'info'|'warn'|'error'='info') {
  const record={timestamp:new Date().toISOString(),level,event:LABEL.test(event)?event:'INVALID_EVENT',...safeLogFields(fields)};
  console[level](JSON.stringify(record));
}
export function requestId() { return randomUUID(); }
