// Server-side account manager for grok-cli (Grok Build) OAuth connections.
// Runs from src/instrumentation.js in the Node runtime:
//   - refresh loop every 30 min: proactively refresh tokens near expiry
//     (refresh lead = 3h, from the grok-cli registry oauth.refreshLeadMs)
//   - quota loop every 60 s: poll billing via getGrokCliUsage; when an account
//     is exhausted, disable it and cool down 25 h before polling it again
// Request-path error rules (429/401 disable, 402/403 delete) live in
// open-sse/config/errorConfig.js PROVIDER_ERROR_RULES and are applied by
// src/sse/services/auth.js markAccountUnavailable.

import { getProviderConnections, updateProviderConnection } from "@/lib/db/index.js";
import { updateProviderCredentials } from "@/sse/services/tokenRefresh.js";
import {
  shouldRefreshCredentials,
  refreshProviderCredentials,
} from "open-sse/services/oauthCredentialManager.js";
import { getGrokCliUsage } from "open-sse/services/usage/grok-cli.js";

export const GROK_CLI_MANAGER_CONFIG = {
  provider: "grok-cli",
  refreshIntervalMs: 30 * 60 * 1000,
  quotaIntervalMs: 60 * 1000,
  quotaCooldownMs: 25 * 60 * 60 * 1000,
};

const QUOTA_COOLDOWN_FIELD = "quotaCooldownUntil";

let refreshTimer = null;
let quotaTimer = null;
let refreshInFlight = false;
let quotaInFlight = false;

function log(message) {
  console.log(`[grok-cli-manager] ${message}`);
}

function connectionLabel(conn) {
  return conn?.displayName || conn?.name || conn?.email || conn?.id?.slice(0, 8) || "?";
}

function isQuotaExhausted(result) {
  const quotas = result?.quotas;
  if (!quotas || typeof quotas !== "object") return false;
  const rows = Object.values(quotas);
  if (rows.length === 0) return false;
  return rows.every((q) => q?.unlimited !== true && (q?.remainingPercentage ?? 100) <= 0);
}

async function refreshLoop() {
  if (refreshInFlight) return;
  refreshInFlight = true;
  try {
    const connections = await getProviderConnections({ provider: GROK_CLI_MANAGER_CONFIG.provider, isActive: true });
    let refreshed = 0;
    for (const conn of connections) {
      if (!conn.refreshToken) continue;
      if (!shouldRefreshCredentials(GROK_CLI_MANAGER_CONFIG.provider, conn)) continue;
      try {
        const newCredentials = await refreshProviderCredentials(
          GROK_CLI_MANAGER_CONFIG.provider,
          conn,
          { info: log, warn: log, error: log, debug: () => {} },
        );
        if (newCredentials?.accessToken || newCredentials?.apiKey) {
          await updateProviderCredentials(conn.id, {
            ...newCredentials,
            existingProviderSpecificData: conn.providerSpecificData,
          });
          refreshed++;
        }
      } catch (error) {
        console.warn(`[grok-cli-manager] refresh failed for ${connectionLabel(conn)}: ${error.message}`);
      }
    }
    if (refreshed > 0) log(`refreshed ${refreshed} connection(s)`);
  } catch (error) {
    console.warn(`[grok-cli-manager] refresh loop error: ${error.message}`);
  } finally {
    refreshInFlight = false;
  }
}

async function quotaLoop() {
  if (quotaInFlight) return;
  quotaInFlight = true;
  try {
    const connections = await getProviderConnections({ provider: GROK_CLI_MANAGER_CONFIG.provider, isActive: true });
    for (const conn of connections) {
      const cooldownUntil = conn[QUOTA_COOLDOWN_FIELD];
      if (cooldownUntil && new Date(cooldownUntil).getTime() > Date.now()) continue;
      if (!conn.accessToken) continue;

      try {
        const result = await getGrokCliUsage(conn.accessToken, conn.providerSpecificData);
        if (isQuotaExhausted(result)) {
          await updateProviderConnection(conn.id, {
            isActive: false,
            [QUOTA_COOLDOWN_FIELD]: new Date(Date.now() + GROK_CLI_MANAGER_CONFIG.quotaCooldownMs).toISOString(),
            testStatus: "unavailable",
            lastError: "quota exhausted",
            lastErrorAt: new Date().toISOString(),
          });
          log(`${connectionLabel(conn)} quota exhausted → disabled (25h cooldown)`);
        }
      } catch (error) {
        console.warn(`[grok-cli-manager] quota poll failed for ${connectionLabel(conn)}: ${error.message}`);
      }
    }
  } catch (error) {
    console.warn(`[grok-cli-manager] quota loop error: ${error.message}`);
  } finally {
    quotaInFlight = false;
  }
}

/** Start the background loops. Idempotent — safe under HMR/dev restarts. */
export function startGrokCliManager() {
  if (refreshTimer || quotaTimer) return;
  refreshLoop();
  refreshTimer = setInterval(refreshLoop, GROK_CLI_MANAGER_CONFIG.refreshIntervalMs);
  quotaLoop();
  quotaTimer = setInterval(quotaLoop, GROK_CLI_MANAGER_CONFIG.quotaIntervalMs);
  refreshTimer.unref?.();
  quotaTimer.unref?.();
  log("started (refresh every 30min, quota every 60s)");
}

/** Stop the background loops (test teardown). */
export function stopGrokCliManager() {
  if (refreshTimer) clearInterval(refreshTimer);
  if (quotaTimer) clearInterval(quotaTimer);
  refreshTimer = null;
  quotaTimer = null;
}