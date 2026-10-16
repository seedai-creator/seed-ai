// Pure delivery contract. Never pass raw errors, prompts or company records here.
export const alertMetrics = {
  errors_15m: 'Falhas registradas nos últimos 15 minutos',
  ai_failures_2m: 'Falhas de IA nos últimos 2 minutos',
  webhook_failures_15m: 'Falhas no processamento de pagamentos em 15 minutos',
  auth_failures_15m: 'Falhas de autenticação registradas em 15 minutos',
  journal_overdue: 'Tarefas do Journal pendentes há mais de 15 minutos',
  cost_unknown_today: 'Registros com custo desconhecido ou pendente no dia UTC',
  accounted_or_reserved_usd_today: 'Custo contabilizado ou reservado no dia UTC (US$)',
  budget_reference_usd: 'Menor limite diário global dos planos disponíveis (US$)',
} as const;
const additionalQueueMetrics = {
  business_model_overdue: 'Tarefas do Modelo Vivo atrasadas há mais de 15 minutos',
  radar_overdue: 'Empresas com processamento do Radar atrasado há mais de 15 minutos',
  external_overdue: 'Pesquisas externas em andamento há mais de 15 minutos',
  growth_overdue: 'Mapas de crescimento atrasados há mais de 15 minutos',
} as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const email = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
function validEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && email.test(value);
}
export function alertConfiguration(env: Record<string, string | undefined>) {
  if (env.SEED_OPERATIONS_ENABLED !== 'true' || env.SEED_ALERTS_ENABLED !== 'true') return null;
  const key = env.RESEND_API_KEY, sender = env.SEED_ALERT_FROM, recipient = env.SEED_ALERT_TO;
  const environment = env.SEED_ENV;
  if (!key || !/^re_[A-Za-z0-9_-]{16,}$/.test(key) || !validEmail(sender) || !validEmail(recipient)
    || !environment || !['development', 'staging', 'production'].includes(environment)
    || env.SEED_STAGING_CORE_ONLY === 'true') throw Error('ALERT_CONFIGURATION_INVALID');
  return {key, sender, recipient, environment};
}
export function renderOperationalAlert(raw: unknown) {
  if (!raw || typeof raw !== 'object') throw Error('INVALID_ALERT');
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== 'string' || !uuid.test(row.id) || !['P1', 'P2'].includes(String(row.severity))
    || !validEmail(row.sender) || !validEmail(row.recipient)
    || !['development', 'staging', 'production'].includes(String(row.environment))
    || typeof row.created_at !== 'string' || !Number.isFinite(Date.parse(row.created_at))
    || !row.metrics || typeof row.metrics !== 'object' || Array.isArray(row.metrics)) throw Error('INVALID_ALERT');
  const metrics = row.metrics as Record<string, unknown>;
  const lines = Object.entries(alertMetrics).map(([key, label]) => {
    const value = metrics[key];
    if (key === 'budget_reference_usd' && value === null) return `${label}: indisponível`;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw Error('INVALID_ALERT');
    return `${label}: ${value}`;
  });
  // Older durable receipts must keep exactly the same email on retry. Append
  // fields only when the newer collector stored them in the immutable payload.
  const hasQueues=Object.keys(additionalQueueMetrics).some(key=>Object.hasOwn(metrics,key));
  if(hasQueues)for(const [key,label] of Object.entries(additionalQueueMetrics)){
    const value=metrics[key];
    if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw Error('INVALID_ALERT');
    lines.push(`${label}: ${value}`);
  }
  return {
    from: row.sender, to: [row.recipient],
    subject: `[SeedAI ${row.environment}] ${row.severity} — verificar operação`,
    text: [`SeedAI — alerta operacional ${row.severity}`, `Ambiente: ${row.environment}`,
      `Registrado: ${new Date(row.created_at).toISOString()}`, `Referência: ${row.id}`, '', ...lines, '',
      'Confira o painel administrativo e os registros do provedor. Este alerta não confirma a causa da falha.',
      'Custos são estimativas e reservas, não uma fatura. O limite de referência não inclui exceções temporárias.',
      'Amostra agregada: nenhum conteúdo de conversa ou dado de empresa foi incluído.',
      'Um novo aviso pode ocorrer na próxima hora se a condição persistir.'].join('\n'),
  };
}
export type AlertDelivery = {providerId: string; retry: false; code: null}
  | {providerId: null; retry: boolean; code: 'PROVIDER_TRANSIENT' | 'PROVIDER_REJECTED' | 'NETWORK_FAILURE' | 'INVALID_RESPONSE' | 'INVALID_ALERT'};
export async function deliverOperationalAlert(raw: unknown, key: string, transport: typeof fetch = fetch): Promise<AlertDelivery> {
  let body: ReturnType<typeof renderOperationalAlert>;
  try { body = renderOperationalAlert(raw); } catch { return {providerId: null, retry: false, code: 'INVALID_ALERT'}; }
  const id = (raw as {id: string}).id;
  try {
    const response = await transport('https://api.resend.com/emails', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
      headers: {'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `seed-operations/${id}`},
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      await response.body?.cancel();
      const retry = response.status === 429 || response.status >= 500;
      return {providerId: null, retry, code: retry ? 'PROVIDER_TRANSIENT' : 'PROVIDER_REJECTED'};
    }
    const result: unknown = await response.json();
    if (result && typeof result === 'object' && 'id' in result && typeof result.id === 'string' && uuid.test(result.id))
      return {providerId: result.id, retry: false, code: null};
    return {providerId: null, retry: true, code: 'INVALID_RESPONSE'};
  } catch { return {providerId: null, retry: true, code: 'NETWORK_FAILURE'}; }
}
