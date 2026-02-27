import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { checkAndLogUsage } from "@/lib/usage/check-limits";

export async function POST(req: NextRequest) {
  try {
    const { apiKey, systemPrompt, userMessage, model } = await req.json();

    const selectedModel = model || "gpt-4o";
    let resolvedKey = apiKey;

    // If no user-provided key, try server-side shared key with auth
    if (!resolvedKey) {
      const serverKey = process.env.OPENAI_API_KEY;
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
      const usage = await checkAndLogUsage(user.id, "openai", selectedModel);
      if (!usage.allowed) {
        return NextResponse.json({ error: usage.reason, usage }, { status: 429 });
      }

      resolvedKey = serverKey;
    }

    const openai = new OpenAI({ apiKey: resolvedKey });

    const completion = await openai.chat.completions.create({
      model: selectedModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 2048,
    });

    return NextResponse.json({
      content: completion.choices[0]?.message?.content ?? "",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "OpenAI API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
