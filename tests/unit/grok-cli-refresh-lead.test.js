import { describe, it, expect } from "vitest";
import { PROVIDER_OAUTH } from "../../open-sse/providers/index.js";
import { getRefreshLeadMs } from "../../open-sse/services/tokenRefresh.js";

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

describe("grok-cli refresh lead", () => {
  it("registry oauth.refreshLeadMs is 3 hours (refresh lead spec)", () => {
    expect(PROVIDER_OAUTH["grok-cli"]?.refreshLeadMs).toBe(THREE_HOURS_MS);
  });

  it("getRefreshLeadMs resolves 3h for both grok-cli ids", () => {
    expect(getRefreshLeadMs("grok-cli")).toBe(THREE_HOURS_MS);
    expect(getRefreshLeadMs("gcli")).toBe(THREE_HOURS_MS);
  });
});
