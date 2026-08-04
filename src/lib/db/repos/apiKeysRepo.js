import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";

function rowToKey(row) {
  if (!row) return null;
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    machineId: row.machineId,
    isActive: row.isActive === 1 || row.isActive === true,
    createdAt: row.createdAt,
    rateLimitRpm: row.rateLimitRpm ?? null,
    tokenQuota: row.tokenQuota ?? null,
    tokenUsed: row.tokenUsed ?? 0,
    quotaResetAt: row.quotaResetAt ?? null,
    modelWhitelist: parseJson(row.modelWhitelist, null),
    expiresAt: row.expiresAt ?? null,
    shareToken: row.shareToken ?? null,
  };
}

// Quota windows are monthly: first instant of next month, UTC.
function nextMonthlyReset(from = new Date()) {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1)).toISOString();
}

export async function getApiKeys() {
  const db = await getAdapter();
  const rows = db.all("SELECT * FROM apiKeys ORDER BY createdAt ASC");
  return rows.map(rowToKey);
}

export async function getApiKeyById(id) {
  const db = await getAdapter();
  const row = db.get("SELECT * FROM apiKeys WHERE id = ?", [id]);
  return rowToKey(row);
}

export async function getApiKeyByShareToken(token) {
  if (!token) return null;
  const db = await getAdapter();
  const row = db.get("SELECT * FROM apiKeys WHERE shareToken = ?", [token]);
  return rowToKey(row);
}

// Full record for limit enforcement. validateApiKey stays boolean because
// dashboardGuard.js consumes it directly as one.
export async function getValidApiKeyRecord(key) {
  if (!key) return null;
  const db = await getAdapter();
  const row = db.get("SELECT * FROM apiKeys WHERE key = ?", [key]);
  if (!row) return null;
  const parsed = rowToKey(row);
  return parsed.isActive ? parsed : null;
}

export async function createApiKey(name, machineId, options = {}) {
  if (!machineId) throw new Error("machineId is required");
  const db = await getAdapter();
  const { generateApiKeyWithMachine } = await import("@/shared/utils/apiKey");
  const result = generateApiKeyWithMachine(machineId);
  const apiKey = {
    id: uuidv4(),
    name,
    key: result.key,
    machineId,
    isActive: true,
    createdAt: new Date().toISOString(),
    rateLimitRpm: options.rateLimitRpm ?? null,
    tokenQuota: options.tokenQuota ?? null,
    tokenUsed: 0,
    quotaResetAt: null,
    modelWhitelist: options.modelWhitelist ?? null,
    expiresAt: options.expiresAt ?? null,
    shareToken: null,
  };
  db.run(
    "INSERT INTO apiKeys(id, key, name, machineId, isActive, createdAt, rateLimitRpm, tokenQuota, tokenUsed, quotaResetAt, modelWhitelist, expiresAt, shareToken) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      apiKey.id, apiKey.key, apiKey.name, apiKey.machineId, 1, apiKey.createdAt,
      apiKey.rateLimitRpm, apiKey.tokenQuota, 0, null,
      apiKey.modelWhitelist == null ? null : stringifyJson(apiKey.modelWhitelist),
      apiKey.expiresAt, null,
    ]
  );
  return apiKey;
}

export async function updateApiKey(id, data) {
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = db.get("SELECT * FROM apiKeys WHERE id = ?", [id]);
    if (!row) return;
    const merged = { ...rowToKey(row), ...data };
    db.run(
      "UPDATE apiKeys SET key = ?, name = ?, machineId = ?, isActive = ?, rateLimitRpm = ?, tokenQuota = ?, tokenUsed = ?, quotaResetAt = ?, modelWhitelist = ?, expiresAt = ?, shareToken = ? WHERE id = ?",
      [
        merged.key, merged.name, merged.machineId, merged.isActive ? 1 : 0,
        merged.rateLimitRpm ?? null, merged.tokenQuota ?? null,
        merged.tokenUsed ?? 0, merged.quotaResetAt ?? null,
        merged.modelWhitelist == null ? null : stringifyJson(merged.modelWhitelist),
        merged.expiresAt ?? null, merged.shareToken ?? null,
        id,
      ]
    );
    result = merged;
  });
  return result;
}

export async function deleteApiKey(id) {
  const db = await getAdapter();
  const res = db.run("DELETE FROM apiKeys WHERE id = ?", [id]);
  return (res?.changes ?? 0) > 0;
}

export async function incrementTokenUsage(keyId, tokens) {
  const amount = Number(tokens);
  if (!keyId || !Number.isFinite(amount) || amount <= 0) return;
  const db = await getAdapter();
  db.run(
    "UPDATE apiKeys SET tokenUsed = COALESCE(tokenUsed, 0) + ? WHERE id = ?",
    [Math.floor(amount), keyId]
  );
}

export async function resetQuotaIfNeeded(keyId) {
  if (!keyId) return null;
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = db.get("SELECT * FROM apiKeys WHERE id = ?", [keyId]);
    if (!row) return;
    const record = rowToKey(row);
    result = record;
    if (!record.tokenQuota) return;
    const due = !record.quotaResetAt || new Date(record.quotaResetAt) <= new Date();
    if (!due) return;
    const nextReset = nextMonthlyReset();
    db.run("UPDATE apiKeys SET tokenUsed = 0, quotaResetAt = ? WHERE id = ?", [nextReset, keyId]);
    result = { ...record, tokenUsed: 0, quotaResetAt: nextReset };
  });
  return result;
}

export async function validateApiKey(key) {
  const db = await getAdapter();
  const row = db.get("SELECT isActive FROM apiKeys WHERE key = ?", [key]);
  if (!row) return false;
  return row.isActive === 1 || row.isActive === true;
}
