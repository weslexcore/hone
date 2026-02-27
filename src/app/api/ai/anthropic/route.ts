import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { checkAndLogUsage } from "@/lib/usage/check-limits";

export async function POST(req: NextRequest) {
  try {
    const { apiKey, systemPrompt, userMessage, model } = await req.json();

    const selectedModel = model || "claude-sonnet-4-20250514";
    let resolvedKey = apiKey;

    // If no user-provided key, try server-side shared key with auth
    if (!resolvedKey) {
      const serverKey = process.env.ANTHROPIC_API_KEY;
      if (!serverKey) {
        return NextResponse.json(
          { error: "API key is required. Sign in to use the shared key, or add your own." },
          { status: 400 },
        );
      }

      // Verify authentication
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json(
          { error: "Sign in to use the shared AI key, or provide your own API key." },
          { status: 401 },
        );
      }

      // Check usage limits
      const usage = await checkAndLogUsage(user.id, "anthropic", selectedModel);
      if (!usage.allowed) {
        return NextResponse.json({ error: usage.reason, usage }, { status: 429 });
      }

      resolvedKey = serverKey;
    }

    const client = new Anthropic({ apiKey: resolvedKey });

    const response = await client.messages.create({
      model: selectedModel,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    return NextResponse.json({ content: textBlock?.text ?? "" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Anthropic API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
