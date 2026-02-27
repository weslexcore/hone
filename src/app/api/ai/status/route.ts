import { NextResponse } from "next/server";

/**
 * Returns which server-side AI providers are configured.
 * No secrets are exposed — just booleans.
 */
export async function GET() {
  return NextResponse.json({
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    ollama: Boolean(process.env.OLLAMA_BASE_URL),
    limits: {
      daily: Number(process.env.DAILY_REQUEST_LIMIT) || 30,
      monthly: Number(process.env.MONTHLY_REQUEST_LIMIT) || 500,
    },
  });
}
