import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("open-sse/index.js", () => ({}), { virtual: true });

const mocks = vi.hoisted(() => ({
  getValidApiKeyRecord: vi.fn(),
  incrementTokenUsage: vi.fn(),
  resetQuotaIfNeeded: vi.fn(),
}));

vi.mock("@/lib/localDb", () => mocks);

import { checkKeyLimits, recordKeyTokenUsage } from "@/sse/services/keyLimits.js";
import { __test__ } from "@/sse/services/keyLimits.js";

const { rateWindows } = __test__;
const { getValidApiKeyRecord, incrementTokenUsage, resetQuotaIfNeeded } = mocks;

function keyRecord(overrides = {}) {
  return {
    id: "k1",
    key: "sk-abc",
    isActive: true,
    rateLimitRpm: null,
    tokenQuota: null,
    tokenUsed: 0,
    quotaResetAt: null,
    modelWhitelist: null,
    expiresAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  getValidApiKeyRecord.mockReset();
  incrementTokenUsage.mockReset();
  resetQuotaIfNeeded.mockReset();
  rateWindows.clear();
  incrementTokenUsage.mockResolvedValue(undefined);
  resetQuotaIfNeeded.mockImplementation(async (id) => keyRecord({ id }));
});

describe("checkKeyLimits", () => {
  it("rejects missing key", async () => {
    const r = await checkKeyLimits({ apiKey: null, model: null });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(401);
  });

  it("rejects unknown key", async () => {
    getValidApiKeyRecord.mockResolvedValue(null);
    const r = await checkKeyLimits({ apiKey: "sk-x", model: null });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(401);
  });

  it("rejects inactive key", async () => {
    getValidApiKeyRecord.mockResolvedValue(null);
    const r = await checkKeyLimits({ apiKey: "sk-x", model: null });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(401);
  });

  it("rejects expired key", async () => {
    getValidApiKeyRecord.mockResolvedValue(
      keyRecord({ expiresAt: new Date(Date.now() - 1000).toISOString() }),
    );
    const r = await checkKeyLimits({ apiKey: "sk-x", model: null });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(401);
    expect(r.error).toMatch(/expired/i);
  });

  it("rejects when token quota exhausted", async () => {
    resetQuotaIfNeeded.mockResolvedValue(
      keyRecord({ tokenQuota: 1000, tokenUsed: 1000 }),
    );
    getValidApiKeyRecord.mockResolvedValue(
      keyRecord({ tokenQuota: 1000, tokenUsed: 1000 }),
    );
    const r = await checkKeyLimits({ apiKey: "sk-x", model: null });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(429);
  });

  it("enforces RPM", async () => {
    getValidApiKeyRecord.mockResolvedValue(keyRecord({ rateLimitRpm: 2 }));
    resetQuotaIfNeeded.mockResolvedValue(keyRecord({ rateLimitRpm: 2, id: "k1" }));
    expect((await checkKeyLimits({ apiKey: "sk-x" })).ok).toBe(true);
    expect((await checkKeyLimits({ apiKey: "sk-x" })).ok).toBe(true);
    const blocked = await checkKeyLimits({ apiKey: "sk-x" });
    expect(blocked.ok).toBe(false);
    expect(blocked.status).toBe(429);
  });

  it("blocks non-whitelisted resolved model", async () => {
    getValidApiKeyRecord.mockResolvedValue(
      keyRecord({ modelWhitelist: ["gcli/grok-build"] }),
    );
    resetQuotaIfNeeded.mockResolvedValue(
      keyRecord({ modelWhitelist: ["gcli/grok-build"] }),
    );
    const ok = await checkKeyLimits({ apiKey: "sk-x", model: "gcli/grok-build" });
    expect(ok.ok).toBe(true);

    const blocked = await checkKeyLimits({ apiKey: "sk-x", model: "openai/gpt-4o" });
    expect(blocked.ok).toBe(false);
    expect(blocked.status).toBe(403);
  });

  it("passes when whitelist is null", async () => {
    getValidApiKeyRecord.mockResolvedValue(keyRecord());
    resetQuotaIfNeeded.mockResolvedValue(keyRecord());
    const r = await checkKeyLimits({ apiKey: "sk-x", model: "anything/whatever" });
    expect(r.ok).toBe(true);
  });

  it("accepts combo name as a whitelisted model id", async () => {
    getValidApiKeyRecord.mockResolvedValue(
      keyRecord({ modelWhitelist: ["my-combo"] }),
    );
    resetQuotaIfNeeded.mockResolvedValue(
      keyRecord({ modelWhitelist: ["my-combo"] }),
    );

    const viaCombo = await checkKeyLimits({ apiKey: "sk-x", model: "my-combo" });
    expect(viaCombo.ok).toBe(true);

    const directMiss = await checkKeyLimits({ apiKey: "sk-x", model: "kr/claude-sonnet-4.5" });
    expect(directMiss.ok).toBe(false);
    expect(directMiss.status).toBe(403);
  });
});

describe("recordKeyTokenUsage", () => {
  it("is fail-open for unknown key", async () => {
    getValidApiKeyRecord.mockResolvedValue(null);
    await expect(recordKeyTokenUsage("sk-x", 100)).resolves.toBeUndefined();
    expect(incrementTokenUsage).not.toHaveBeenCalled();
  });

  it("ignores non-finite tokens", async () => {
    getValidApiKeyRecord.mockResolvedValue(keyRecord());
    await recordKeyTokenUsage("sk-x", NaN);
    await recordKeyTokenUsage("sk-x", -5);
    expect(incrementTokenUsage).not.toHaveBeenCalled();
  });

  it("increments usage for valid key", async () => {
    getValidApiKeyRecord.mockResolvedValue(keyRecord());
    await recordKeyTokenUsage("sk-x", 42);
    expect(incrementTokenUsage).toHaveBeenCalledWith("k1", 42);
  });

  it("never throws when DB throws", async () => {
    getValidApiKeyRecord.mockResolvedValue(keyRecord());
    incrementTokenUsage.mockRejectedValue(new Error("db down"));
    await expect(recordKeyTokenUsage("sk-x", 42)).resolves.toBeUndefined();
  });
});
