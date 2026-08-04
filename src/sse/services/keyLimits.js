import {
  getValidApiKeyRecord,
  incrementTokenUsage,
  resetQuotaIfNeeded,
} from "@/lib/localDb";

const WINDOW_MS = 60_000;

// In-process sliding window: resets on server restart / HMR reload.
const rateWindows = new Map();

function underRateLimit(keyId, limit) {
  if (!limit || limit <= 0) return true;
  const now = Date.now();
  const entry = rateWindows.get(keyId);
  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    rateWindows.set(keyId, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

/**
 * @param {{ apiKey: string, model?: string|null }} args
 *   model must be the RESOLVED "provider/model" so aliases and combos
 *   cannot route around the whitelist. Pass null before resolution.
 * @returns {Promise<{ok: true, record: object} | {ok: false, status: number, error: string}>}
 */
export async function checkKeyLimits({ apiKey, model = null }) {
  if (!apiKey) return { ok: false, status: 401, error: "Missing API key" };

  let record = await getValidApiKeyRecord(apiKey);
  if (!record) return { ok: false, status: 401, error: "Invalid API key" };

  if (record.expiresAt && new Date(record.expiresAt) <= new Date()) {
    return { ok: false, status: 401, error: "API key expired" };
  }

  const refreshed = await resetQuotaIfNeeded(record.id);
  if (refreshed) record = refreshed;
  if (record.tokenQuota && record.tokenUsed >= record.tokenQuota) {
    return { ok: false, status: 429, error: "Token quota exceeded" };
  }

  if (!underRateLimit(record.id, record.rateLimitRpm)) {
    return { ok: false, status: 429, error: "Rate limit exceeded" };
  }

  const whitelist = record.modelWhitelist;
  if (model && Array.isArray(whitelist) && whitelist.length > 0 && !whitelist.includes(model)) {
    return { ok: false, status: 403, error: "Model not allowed for this key" };
  }

  return { ok: true, record };
}

/** Fail-open: quota bookkeeping must never break a response. */
export async function recordKeyTokenUsage(apiKey, totalTokens) {
  try {
    if (!apiKey) return;
    const amount = Number(totalTokens);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const record = await getValidApiKeyRecord(apiKey);
    if (!record) return;
    await incrementTokenUsage(record.id, amount);
  } catch {
    /* fail-open */
  }
}

export const __test__ = { rateWindows, underRateLimit };
