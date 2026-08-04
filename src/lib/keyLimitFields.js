// Shared parse/validate for the per-key limit fields on the /api/keys routes.

function parseNullableInt(value, label, errors) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    errors.push(label + " must be a non-negative number");
    return undefined;
  }
  return Math.floor(num);
}

export function parseKeyLimitFields(body) {
  const errors = [];
  const out = {};

  const rateLimitRpm = parseNullableInt(body.rateLimitRpm, "rateLimitRpm", errors);
  if (rateLimitRpm !== undefined) out.rateLimitRpm = rateLimitRpm;

  const tokenQuota = parseNullableInt(body.tokenQuota, "tokenQuota", errors);
  if (tokenQuota !== undefined) out.tokenQuota = tokenQuota;

  if (body.modelWhitelist !== undefined) {
    const list = body.modelWhitelist;
    if (list === null || (Array.isArray(list) && list.length === 0)) {
      out.modelWhitelist = null;
    } else if (Array.isArray(list) && list.every((m) => typeof m === "string" && m.trim())) {
      out.modelWhitelist = list.map((m) => m.trim());
    } else {
      errors.push("modelWhitelist must be an array of model id strings");
    }
  }

  if (body.expiresAt !== undefined) {
    if (body.expiresAt === null || body.expiresAt === "") {
      out.expiresAt = null;
    } else {
      const date = new Date(body.expiresAt);
      if (Number.isNaN(date.getTime())) errors.push("expiresAt must be a valid date");
      else out.expiresAt = date.toISOString();
    }
  }

  return { fields: out, errors };
}

// shareToken is issued only by the share route and never surfaces in list responses.
export function stripShareToken(key) {
  if (!key) return key;
  const rest = { ...key };
  delete rest.shareToken;
  return rest;
}
