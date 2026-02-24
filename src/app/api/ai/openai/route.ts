import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  try {
    const { apiKey, systemPrompt, userMessage, model } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: model || 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 2048,
    });

    return NextResponse.json({
      content: completion.choices[0]?.message?.content ?? '',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'OpenAI API error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
