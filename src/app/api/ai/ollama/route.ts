import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAndLogUsage } from "@/lib/usage/check-limits";

export async function POST(req: NextRequest) {
  try {
    const { baseUrl, model, systemPrompt, userMessage, ollamaApiKey, useSharedKey } =
      await req.json();

    const ollamaModel = model || "llama3.2";
    let ollamaUrl = (baseUrl || "http://localhost:11434").replace(/\/+$/, "");
    let resolvedApiKey = ollamaApiKey;

    // If requesting shared key mode, use server-side Ollama config
    if (useSharedKey && !baseUrl) {
      const serverUrl = process.env.OLLAMA_BASE_URL;
      if (!serverUrl) {
        return NextResponse.json(
          { error: "Server Ollama is not configured." },
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
          { error: "Sign in to use the shared AI key, or provide your own Ollama configuration." },
          { status: 401 },
        );
      }

      // Check usage limits
      const usage = await checkAndLogUsage(user.id, "ollama", ollamaModel);
      if (!usage.allowed) {
        return NextResponse.json({ error: usage.reason, usage }, { status: 429 });
      }

      ollamaUrl = serverUrl.replace(/\/+$/, "");
      resolvedApiKey = process.env.OLLAMA_API_KEY || undefined;
    }

    // Build headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (resolvedApiKey) {
      headers["Authorization"] = `Bearer ${resolvedApiKey}`;
    }

    const estimatedTokens = Math.ceil(
      ((systemPrompt?.length || 0) + (userMessage?.length || 0)) / 4,
    );
    const numCtx = Math.max(8192, estimatedTokens + 2048);

    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: ollamaModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        stream: false,
        options: {
          num_ctx: numCtx,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "Unknown error");
      return NextResponse.json(
        { error: `Ollama error (${response.status}): ${text}` },
        { status: response.status },
      );
    }

    const data = await response.json();
    const content = data.message?.content ?? "";

    return NextResponse.json({ content });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Ollama request failed";
    if (message.includes("ECONNREFUSED") || message.includes("fetch failed")) {
      return NextResponse.json(
        {
          error:
            "Could not connect to Ollama. Make sure it is running, or use Ollama Cloud with an API key.",
        },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
