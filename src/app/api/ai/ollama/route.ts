import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { baseUrl, model, systemPrompt, userMessage, ollamaApiKey } = await req.json();

    const ollamaUrl = (baseUrl || "http://localhost:11434").replace(/\/+$/, "");
    const ollamaModel = model || "llama3.2";

    // Build headers — add Authorization for Ollama Cloud when an API key is provided
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (ollamaApiKey) {
      headers["Authorization"] = `Bearer ${ollamaApiKey}`;
    }

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
    // Common: connection refused when Ollama isn't running locally
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
