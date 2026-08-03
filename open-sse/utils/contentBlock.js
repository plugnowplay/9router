// Detect upstream content-filter "soft blocks" that arrive as HTTP 200 success
// with the block message as normal assistant content. CodeBuddy CN (Tencent)
// returns a Chinese sensitive-content notice this way instead of an error status:
//   "抱歉，系统检测到您当前输入的信息存在敏感内容，我无法响应您的请求，请检查后重新输入。"
// These must surface as errors so combo/account fallback moves on instead of
// delivering the block text as if it were a real answer.

// Tight patterns — match the CodeBuddy CN sensitive-content notice family only,
// so legitimate Chinese replies (rarely mentioning the phrase) never false-positive.
const SENSITIVE_BLOCK_PATTERNS = [
  /抱歉[，,、]?\s*系统检测到[^，。;；\n]{0,40}敏感内容/,
  /系统检测到[^，。;；\n]{0,40}敏感内容/,
  /检测到[^，。;；\n]{0,20}敏感内容/,
  /敏感内容[^，。;；\n]{0,20}无法响应/,
  /我无法响应您的请求[^。；;]{0,20}(?:重新输入|检查)/,
];

// Providers known to soft-block this way (200 + block text as content).
const CONTENT_BLOCK_PROVIDERS = new Set(["codebuddy-cn", "codebuddy-intl"]);

/** True when the provider needs content-block detection on 2xx responses. */
export function isContentBlockProvider(provider) {
  return typeof provider === "string" && CONTENT_BLOCK_PROVIDERS.has(provider);
}

/**
 * Find a content-filter block phrase inside response text.
 * @param {string} text
 * @returns {string|null} matched phrase or null when allowed
 */
export function findContentBlock(text) {
  if (typeof text !== "string" || text.length === 0) return null;
  for (const pattern of SENSITIVE_BLOCK_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return null;
}