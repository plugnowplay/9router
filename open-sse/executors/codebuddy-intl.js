import crypto from "crypto";
import { DefaultExecutor } from "./default.js";
import { sanitizeRequestBody } from "../utils/contentFilters.js";

/**
 * CodeBuddyIntlExecutor — talks to https://www.workbuddy.ai/v2/chat/completions
 *
 * The intl gateway (workbuddy.ai) enforces stricter request validation than CN:
 * requires X-Domain, per-request conversation IDs, and browser-like User-Agent.
 * CLI-style headers trigger code 11140 "request illegal".
 */
export class CodeBuddyIntlExecutor extends DefaultExecutor {
  constructor() {
    super("codebuddy-intl");
  }

  buildHeaders(credentials, stream = true) {
    const headers = super.buildHeaders(credentials, stream);
    const token = credentials?.accessToken || credentials?.apiKey || "";
    if (token) headers["X-Api-Key"] = token;
    const hexId = () => crypto.randomUUID().replace(/-/g, "");
    headers["X-Conversation-ID"] = crypto.randomUUID();
    headers["X-Conversation-Request-ID"] = hexId();
    headers["X-Conversation-Message-ID"] = hexId();
    headers["X-Request-ID"] = hexId();
    return headers;
  }

  transformRequest(model, body, stream, credentials) {
    const transformed = super.transformRequest(model, body, stream, credentials);
    sanitizeRequestBody(transformed);
    transformed.stream = true;

    const eff = transformed.reasoning_effort;
    if (eff === "none" || eff === "off") {
      delete transformed.reasoning_effort;
    } else if (eff) {
      transformed.reasoning_summary = "auto";
    }
    return transformed;
  }
}

export default CodeBuddyIntlExecutor;
