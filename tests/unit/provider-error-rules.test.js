import { describe, it, expect } from "vitest";
import {
  PROVIDER_ERROR_RULES,
  ERROR_RULES,
} from "../../open-sse/config/errorConfig.js";
import { checkFallbackError } from "../../open-sse/services/accountFallback.js";

describe("PROVIDER_ERROR_RULES", () => {
  it("grok-cli: 401/429 disable, 402/403 delete", () => {
    const rules = PROVIDER_ERROR_RULES["grok-cli"];
    expect(rules[401]).toBe("disable");
    expect(rules[429]).toBe("disable");
    expect(rules[402]).toBe("delete");
    expect(rules[403]).toBe("delete");
  });

  it("gcli alias mirrors grok-cli rules", () => {
    expect(PROVIDER_ERROR_RULES.gcli).toEqual(PROVIDER_ERROR_RULES["grok-cli"]);
  });
});

describe("sensitive-content error classification", () => {
  it("text rule maps 'sensitive content' to fallback with a short cooldown", () => {
    const rule = ERROR_RULES.find((r) => r.text === "sensitive content");
    expect(rule).toBeDefined();
    expect(rule.cooldownMs).toBeLessThanOrEqual(30 * 1000);
  });

  it("checkFallbackError triggers fallback for the content-block message", () => {
    const { shouldFallback, cooldownMs } = checkFallbackError(
      400,
      "Upstream content filter blocked this request (sensitive content)",
      0,
    );
    expect(shouldFallback).toBe(true);
    expect(cooldownMs).toBeGreaterThan(0);
  });
});
