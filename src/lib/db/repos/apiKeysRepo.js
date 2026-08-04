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
    isPublic: row.isPublic === 1 || row.isPublic === true,
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

// The single public key surfaced on the landing page (root /). NULL when none
// is marked public — at most one row can be isPublic=1 (enforced by setPublic).
export async function getPublicApiKey() {
  const db = await getAdapter();
  const row = db.get("SELECT * FROM apiKeys WHERE isPublic = 1 LIMIT 1");
  return rowToKey(row);
}

// Promote this key to the single public key: clear isPublic on every other row,
// then set isPublic=1 here. shareToken is also minted so the existing
// /api/share/[token] route keeps working for anyone still using a token URL.
export async function setPublicApiKey(id) {
  if (!id) return null;
  const { v4: uuidv4 } = await import("uuid");
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = db.get("SELECT * FROM apiKeys WHERE id = ?", [id]);
    if (!row) return;
    db.run("UPDATE apiKeys SET isPublic = 0 WHERE id != ?", [id]);
    const shareToken = row.shareToken || uuidv4();
    db.run("UPDATE apiKeys SET isPublic = 1, shareToken = ? WHERE id = ?", [shareToken, id]);
    result = rowToKey(db.get("SELECT * FROM apiKeys WHERE id = ?", [id]));
  });
  return result;
}

export async function unsetPublicApiKey(id) {
  if (!id) return null;
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = db.get("SELECT * FROM apiKeys WHERE id = ?", [id]);
    if (!row) return;
    db.run("UPDATE apiKeys SET isPublic = 0, shareToken = NULL WHERE id = ?", [id]);
    result = rowToKey(db.get("SELECT * FROM apiKeys WHERE id = ?", [id]));
  });
  return result;
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
    isPublic: false,
  };
  db.run(
    "INSERT INTO apiKeys(id, key, name, machineId, isActive, createdAt, rateLimitRpm, tokenQuota, tokenUsed, quotaResetAt, modelWhitelist, expiresAt, shareToken, isPublic) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      apiKey.id, apiKey.key, apiKey.name, apiKey.machineId, 1, apiKey.createdAt,
      apiKey.rateLimitRpm, apiKey.tokenQuota, 0, null,
      apiKey.modelWhitelist == null ? null : stringifyJson(apiKey.modelWhitelist),
      apiKey.expiresAt, null, 0,
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
      "UPDATE apiKeys SET key = ?, name = ?, machineId = ?, isActive = ?, rateLimitRpm = ?, tokenQuota = ?, tokenUsed = ?, quotaResetAt = ?, modelWhitelist = ?, expiresAt = ?, shareToken = ?, isPublic = ? WHERE id = ?",
      [
        merged.key, merged.name, merged.machineId, merged.isActive ? 1 : 0,
        merged.rateLimitRpm ?? null, merged.tokenQuota ?? null,
        merged.tokenUsed ?? 0, merged.quotaResetAt ?? null,
        merged.modelWhitelist == null ? null : stringifyJson(merged.modelWhitelist),
        merged.expiresAt ?? null, merged.shareToken ?? null,
        merged.isPublic ? 1 : 0,
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
