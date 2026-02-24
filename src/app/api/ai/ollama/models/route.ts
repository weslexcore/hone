import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { baseUrl, ollamaApiKey } = await req.json();

    const ollamaUrl = (baseUrl || 'http://localhost:11434').replace(/\/+$/, '');

    const headers: Record<string, string> = {};
    if (ollamaApiKey) {
      headers['Authorization'] = `Bearer ${ollamaApiKey}`;
    }

    const response = await fetch(`${ollamaUrl}/api/tags`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'Unknown error');
      return NextResponse.json(
        { error: `Ollama error (${response.status}): ${text}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    // Ollama returns { models: [{ name, model, modified_at, size, ... }] }
    const models: string[] = (data.models || [])
      .map((m: { name: string }) => m.name)
      .sort((a: string, b: string) => a.localeCompare(b));

    return NextResponse.json({ models });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list models';
    if (message.includes('ECONNREFUSED') || message.includes('fetch failed')) {
      return NextResponse.json(
        { error: 'Could not connect to Ollama. Make sure it is running.' },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
