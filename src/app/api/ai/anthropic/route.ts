import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  try {
    const { apiKey, systemPrompt, userMessage, model } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: "API key is required" }, { status: 400 });
    }

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: model || "claude-sonnet-4-20250514",
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
