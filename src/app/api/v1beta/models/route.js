import { PROVIDER_MODELS } from "@/shared/constants/models";
import { getValidApiKeyRecord } from "@/lib/localDb";
import { extractApiKey } from "@/sse/services/auth.js";

/**
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*"
    }
  });
}

/**
 * GET /v1beta/models - Gemini compatible models list
 * Returns models in Gemini API format
 */
export async function GET(request) {
  try {
    const models = [];
    const seen = new Set();

    function addModel({ name, displayName, description, methods = ["generateContent"] }) {
      if (seen.has(name)) return;
      seen.add(name);
      models.push({
        name,
        displayName,
        description,
        supportedGenerationMethods: methods,
        inputTokenLimit: 128000,
        outputTokenLimit: 8192,
      });
    }

    let whitelist = null;
    const apiKey = request ? extractApiKey(request) : null;
    if (apiKey) {
      try {
        const record = await getValidApiKeyRecord(apiKey);
        if (Array.isArray(record?.modelWhitelist) && record.modelWhitelist.length > 0) {
          whitelist = new Set(record.modelWhitelist.map((m) => String(m).trim()).filter(Boolean));
        }
      } catch {
        whitelist = null;
      }
    }
    const isAllowed = (provider, modelId) => {
      if (!whitelist) return true;
      return whitelist.has(`${provider}/${modelId}`) || whitelist.has(modelId);
    };

    for (const [provider, providerModels] of Object.entries(PROVIDER_MODELS)) {
      for (const model of providerModels) {
        if (!isAllowed(provider, model.id)) continue;
        addModel({
          name: `models/${provider}/${model.id}`,
          displayName: model.name || model.id,
          description: `${provider} model: ${model.name || model.id}`,
        });

        if (provider === "gemini") {
          addModel({
            name: `models/${model.id}`,
            displayName: model.name || model.id,
            description: `Gemini model: ${model.name || model.id}`,
            methods: ["generateContent", "streamGenerateContent"],
          });
        }
      }
    }

    return Response.json({ models });
  } catch (error) {
    console.log("Error fetching models:", error);
    return Response.json({ error: { message: error.message } }, { status: 500 });
  }
}
