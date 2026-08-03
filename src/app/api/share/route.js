import { NextResponse } from "next/server";
import { getApiKeys, getSettings } from "@/lib/localDb";
import { AI_MODELS } from "@/shared/constants/config";
import { getProviderAlias } from "@/shared/constants/providers";
import { getDisabledModels } from "@/lib/disabledModelsDb";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { origin } = new URL(request.url);
    const settings = await getSettings();
    const keys = await getApiKeys();
    const disabled = await getDisabledModels();

    const activeKey = keys.find((k) => k.isActive !== false);

    const models = AI_MODELS
      .filter((m) => {
        const alias = getProviderAlias(m.provider) || m.provider;
        const list = disabled[alias] || disabled[m.provider] || [];
        return !list.includes(m.model);
      })
      .map((m) => {
        const alias = getProviderAlias(m.provider) || m.provider;
        return `${alias}/${m.model}`;
      });

    return NextResponse.json({
      baseUrl: origin,
      apiKey: activeKey?.key ?? null,
      models,
    });
  } catch (error) {
    console.log("Error fetching share info:", error);
    return NextResponse.json({ error: "Failed to fetch share info" }, { status: 500 });
  }
}
