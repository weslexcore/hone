import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { apiKey } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'Unknown error');
      return NextResponse.json(
        { error: `OpenAI error (${response.status}): ${text}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Filter to only chat-capable models (gpt-*, o1*, o3*, chatgpt-*)
    // and exclude internal/system models
    const chatModelPrefixes = ['gpt-', 'o1', 'o3', 'o4', 'chatgpt-'];
    const excludePatterns = ['instruct', 'realtime', 'audio', 'tts', 'whisper', 'dall-e', 'embedding', 'moderation', 'davinci', 'babbage', 'search'];

    const models = (data.data || [])
      .filter((m: { id: string; owned_by: string }) => {
        const id = m.id.toLowerCase();
        const matchesPrefix = chatModelPrefixes.some(p => id.startsWith(p));
        const isExcluded = excludePatterns.some(p => id.includes(p));
        return matchesPrefix && !isExcluded;
      })
      .map((m: { id: string }) => ({
        id: m.id,
        label: m.id,
      }))
      .sort((a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label));

    return NextResponse.json({ models });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list models';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
