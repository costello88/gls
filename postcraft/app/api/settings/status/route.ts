import { requireUser, jsonOk } from "@/lib/api";

export async function GET() {
  const { error } = await requireUser();
  if (error) return error;

  return jsonOk({
    providers: {
      openai: Boolean(process.env.OPENAI_API_KEY),
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      replicate: Boolean(process.env.REPLICATE_API_TOKEN),
      higgsfield: Boolean(process.env.HIGGSFIELD_API_KEY && process.env.HIGGSFIELD_API_SECRET),
    },
    meta_app: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET),
    cron: Boolean(process.env.CRON_SECRET),
    encryption: (process.env.TOKEN_ENCRYPTION_KEY ?? "").length === 64,
    app_url: process.env.NEXT_PUBLIC_APP_URL ?? null,
  });
}
