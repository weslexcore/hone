import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { apiKey } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: "API key is required" }, { status: 400 });
    }

    const response = await fetch("https://api.anthropic.com/v1/models?limit=100", {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "Unknown error");
      return NextResponse.json(
        { error: `Anthropic error (${response.status}): ${text}` },
        { status: response.status },
      );
    }

    const data = await response.json();
    const models = (data.data || [])
      .map((m: { id: string; display_name: string }) => ({
        id: m.id,
        label: m.display_name || m.id,
      }))
      .sort((a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label));

    return NextResponse.json({ models });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to list models";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
