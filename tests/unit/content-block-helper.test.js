import { describe, it, expect } from "vitest";
import {
  findContentBlock,
  isContentBlockProvider,
} from "../../open-sse/utils/contentBlock.js";

const BLOCK_MESSAGE =
  "抱歉，系统检测到您当前输入的信息存在敏感内容，我无法响应您的请求，请检查后重新输入。";

describe("findContentBlock", () => {
  it("detects the full CodeBuddy CN sensitive-content notice", () => {
    expect(findContentBlock(BLOCK_MESSAGE)).toContain("敏感内容");
  });

  it("detects the notice without the 抱歉 prefix", () => {
    expect(findContentBlock("系统检测到您当前输入的信息存在敏感内容")).toContain("敏感内容");
  });

  it("detects the 我无法响应您的请求 variant", () => {
    expect(findContentBlock("检测到敏感内容，我无法响应您的请求")).toBeTruthy();
  });

  it("returns null for a legit Chinese reply mentioning 敏感内容 without block phrasing", () => {
    expect(findContentBlock("这是一段普通的中文回答，没有敏感内容。")).toBeNull();
  });

  it("returns null for empty / non-string input", () => {
    expect(findContentBlock("")).toBeNull();
    expect(findContentBlock(null)).toBeNull();
    expect(findContentBlock(undefined)).toBeNull();
  });

  it("returns null for ordinary English content", () => {
    expect(findContentBlock("The model output was fine.")).toBeNull();
  });
});

describe("isContentBlockProvider", () => {
  it("covers codebuddy-cn and codebuddy-intl", () => {
    expect(isContentBlockProvider("codebuddy-cn")).toBe(true);
    expect(isContentBlockProvider("codebuddy-intl")).toBe(true);
  });

  it("excludes other providers and junk input", () => {
    expect(isContentBlockProvider("grok-cli")).toBe(false);
    expect(isContentBlockProvider("codex")).toBe(false);
    expect(isContentBlockProvider(null)).toBe(false);
    expect(isContentBlockProvider("")).toBe(false);
  });
});
