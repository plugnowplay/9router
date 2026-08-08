import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("open-sse/index.js", () => ({}), { virtual: true });

const mocks = vi.hoisted(() => ({
  getValidApiKeyRecord: vi.fn(),
}));

vi.mock("@/lib/localDb", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getValidApiKeyRecord: mocks.getValidApiKeyRecord };
});

vi.mock("@/lib/disabledModelsDb", () => ({
  getDisabledModels: vi.fn(async () => ({})),
  getDisabledByProvider: vi.fn(async () => []),
  disableModels: vi.fn(),
  enableModels: vi.fn(),
}));

vi.mock("open-sse/services/kiroModels.js", () => ({ resolveKiroModels: vi.fn(async () => null) }));
vi.mock("open-sse/services/kimchiModels.js", () => ({ resolveKimchiModels: vi.fn(async () => null) }));
vi.mock("open-sse/services/qoderModels.js", () => ({ resolveQoderModels: vi.fn(async () => null) }));
vi.mock("open-sse/services/copilotModels.js", () => ({ resolveCopilotModels: vi.fn(async () => null) }));
vi.mock("open-sse/services/clinepassModels.js", () => ({ resolveClinepassModels: vi.fn(async () => null) }));
vi.mock("open-sse/services/grokCliModels.js", () => ({ resolveGrokCliModels: vi.fn(async () => null) }));
vi.mock("open-sse/services/cursorModels.js", () => ({ resolveCursorModels: vi.fn(async () => null) }));
vi.mock("open-sse/shared/zedAuth.js", () => ({ resolveZedModels: vi.fn(async () => null) }));
vi.mock("@/sse/services/tokenRefresh", () => ({ updateProviderCredentials: vi.fn() }));
vi.mock("@/lib/network/connectionProxy", () => ({ resolveConnectionProxyConfig: vi.fn(async () => ({})) }));

const { filterModelsByApiKey } = await import("@/app/api/v1/models/route.js");

function fakeRequest(apiKey) {
  if (!apiKey) return new Request("http://x/v1/models");
  return new Request("http://x/v1/models", { headers: { Authorization: `Bearer ${apiKey}` } });
}

const SAMPLE = [
  { id: "glm/glm-5.2", object: "model", owned_by: "glm" },
  { id: "cc/claude-opus-4-7", object: "model", owned_by: "cc" },
  { id: "kr/claude-sonnet-4.5", object: "model", owned_by: "kr" },
  { id: "my-combo", object: "model", owned_by: "combo" },
];

describe("filterModelsByApiKey", () => {
  beforeEach(() => {
    mocks.getValidApiKeyRecord.mockReset();
  });

  it("returns input unchanged when no apiKey", async () => {
    const out = await filterModelsByApiKey(fakeRequest(null), SAMPLE);
    expect(out).toBe(SAMPLE);
    expect(mocks.getValidApiKeyRecord).not.toHaveBeenCalled();
  });

  it("returns input unchanged when key has no whitelist", async () => {
    mocks.getValidApiKeyRecord.mockResolvedValue({ id: "k1", modelWhitelist: null });
    const out = await filterModelsByApiKey(fakeRequest("sk-x"), SAMPLE);
    expect(out).toEqual(SAMPLE);
  });

  it("returns input unchanged when whitelist is empty array", async () => {
    mocks.getValidApiKeyRecord.mockResolvedValue({ id: "k1", modelWhitelist: [] });
    const out = await filterModelsByApiKey(fakeRequest("sk-x"), SAMPLE);
    expect(out).toEqual(SAMPLE);
  });

  it("narrows to whitelisted ids", async () => {
    mocks.getValidApiKeyRecord.mockResolvedValue({
      id: "k1",
      modelWhitelist: ["glm/glm-5.2", "my-combo"],
    });
    const out = await filterModelsByApiKey(fakeRequest("sk-x"), SAMPLE);
    expect(out.map((m) => m.id)).toEqual(["glm/glm-5.2", "my-combo"]);
  });

  it("returns empty when whitelist matches nothing", async () => {
    mocks.getValidApiKeyRecord.mockResolvedValue({
      id: "k1",
      modelWhitelist: ["nonexistent/model"],
    });
    const out = await filterModelsByApiKey(fakeRequest("sk-x"), SAMPLE);
    expect(out).toEqual([]);
  });

  it("fails open on DB error", async () => {
    mocks.getValidApiKeyRecord.mockRejectedValue(new Error("db down"));
    const out = await filterModelsByApiKey(fakeRequest("sk-x"), SAMPLE);
    expect(out).toEqual(SAMPLE);
  });

  it("fails open on unknown key", async () => {
    mocks.getValidApiKeyRecord.mockResolvedValue(null);
    const out = await filterModelsByApiKey(fakeRequest("sk-x"), SAMPLE);
    expect(out).toEqual(SAMPLE);
  });
});
