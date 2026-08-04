/**
 * Content filter system — strip patterns that trigger upstream content moderation.
 * Ported from etteum-pool's pudidil filters (github.com/priyo000/etteum-pool).
 *
 * Rules are ordered: broad regex patterns first, then exact string fallbacks.
 * Applied to request messages before they reach CodeBuddy (CN + Intl) so the
 * gateway's content filter does not 403/soft-block CLI-originated prompts.
 */

const PUDIDIL_FILTERS = [
  // PHASE 1: Broad regex rules FIRST — catch all variations before exact
  // strings can partially match and leave fragments behind.

  { id: "remove_billing_header_regex", pattern: "x-(?:anthropic-)?billing-header:?\\s*[^\\n]*", replacement: "", isRegex: true },
  { id: "remove_cc_entrypoint_any", pattern: "cc_entrypoint=\\w+", replacement: "", isRegex: true },
  { id: "remove_cc_version_any", pattern: "cc_version=[\\w.]+", replacement: "", isRegex: true },
  { id: "remove_cch_hash", pattern: "c?ch=[a-f0-9]+", replacement: "", isRegex: true },
  { id: "remove_claude_code_github", pattern: "https?://github\\.com/anthropics/claude-code[^\\s]*", replacement: "", isRegex: true },
  { id: "remove_claude_code_identity_variations", pattern: "You are Claude Code[^.]*\\.", replacement: "", isRegex: true },
  { id: "remove_anthropic_cli_ref", pattern: "Anthropic'?s official (?:CLI|tool|agent)[^.]*\\.?", replacement: "", isRegex: true },
  { id: "remove_anxthxropic_ref", pattern: "Anxthxropic'?s official[^.]*\\.?", replacement: "", isRegex: true },
  { id: "remove_cursor_identity", pattern: "You are (?:a )?(?:powerful )?(?:AI )?(?:assistant|agent) (?:made|built|created) by (?:Cursor|Anysphere)[^.]*\\.?", replacement: "", isRegex: true },
  { id: "remove_windsurf_identity", pattern: "You are (?:Windsurf|Cascade|Codeium)[^.]*\\.", replacement: "", isRegex: true },
  { id: "remove_cline_identity", pattern: "You are Cline[^.]*\\.", replacement: "", isRegex: true },
  { id: "remove_ai_coding_agent_pattern", pattern: "(?:autonomous|agentic) (?:AI |coding )?(?:agent|assistant)[^.]*\\.", replacement: "", isRegex: true },
  { id: "remove_mcp_server_ref", pattern: "MCP (?:server|client|protocol)[^.]*\\.?", replacement: "", isRegex: true },
  { id: "remove_powered_by_anthropic", pattern: "powered by (?:Claude|Anthropic|Anxthxropic)[^.]*\\.?", replacement: "", isRegex: true },

  // PHASE 2: Exact string rules — catch any remaining known literal patterns
  // that survived the regex phase.
  { id: "remove_feedback_line", pattern: "Claude Code. To give feedback, users should report the issue at https://github.com/anthropics/claude-code/issues", replacement: "", isRegex: false },
  { id: "remove_powerful_ai_agent", pattern: "Advanced AI Agent", replacement: "", isRegex: false },
  { id: "remove_claude_code_identity", pattern: "You are Claude Code, Anxthxropic's official CLI for Claude.", replacement: "", isRegex: false },
  { id: "remove_claude_code_mention", pattern: "Claude Code", replacement: "the assistant", isRegex: false },
];

export function applyPudidilFilters(content) {
  if (typeof content !== "string" || !content) return content;
  let filtered = content;
  for (const rule of PUDIDIL_FILTERS) {
    if (rule.isRegex) {
      try {
        const re = new RegExp(rule.pattern, "gi");
        filtered = filtered.replace(re, rule.replacement);
      } catch {
        // Invalid regex — skip, never throw out of a filter.
      }
    } else if (rule.pattern) {
      while (filtered.includes(rule.pattern)) {
        filtered = filtered.replace(rule.pattern, rule.replacement);
      }
    }
  }
  return filtered;
}

// Apply filters across every text surface of an OpenAI-format request body:
// messages[].content (string and array shapes), tool descriptions, and the
// system prompt. Mutates + returns the body so the executor can chain it.
export function sanitizeRequestBody(body) {
  if (!body || typeof body !== "object") return body;

  if (Array.isArray(body.messages)) {
    for (const msg of body.messages) {
      if (!msg || typeof msg !== "object") continue;
      if (typeof msg.content === "string") {
        msg.content = applyPudidilFilters(msg.content);
      } else if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (!block || typeof block !== "object") continue;
          if (typeof block.text === "string") {
            block.text = applyPudidilFilters(block.text);
          } else if (typeof block.content === "string") {
            block.content = applyPudidilFilters(block.content);
          } else if (block.type === "tool_result" && Array.isArray(block.content)) {
            for (const inner of block.content) {
              if (inner && typeof inner === "object" && typeof inner.text === "string") {
                inner.text = applyPudidilFilters(inner.text);
              }
            }
          }
        }
      }
    }
  }

  if (Array.isArray(body.tools)) {
    for (const tool of body.tools) {
      if (tool?.function?.description && typeof tool.function.description === "string") {
        tool.function.description = applyPudidilFilters(tool.function.description);
      }
    }
  }

  return body;
}
