export const COMPANY_BATCH_SIZE = 25;

// Rotate a bounded page each minute. For a stable company list, every company
// is visited once per cycle; retries within a minute revisit the same page.
export function scheduledCompanyRange(count: number, now = Date.now()) {
  if (!Number.isSafeInteger(count) || count < 0 || !Number.isFinite(now) || now < 0) {
    throw new Error("INVALID_SCHEDULE_INPUT");
  }
  const pages = Math.max(1, Math.ceil(count / COMPANY_BATCH_SIZE));
  const offset = (Math.floor(now / 60_000) % pages) * COMPANY_BATCH_SIZE;
  return { from: offset, to: offset + COMPANY_BATCH_SIZE - 1 };
}
