import type { AIProvider, AIRequest } from '@/types/ai';

/**
 * Strip markdown code fences that AI models often wrap around JSON responses.
 * Handles ```json ... ```, ``` ... ```, and leading/trailing whitespace.
 */
export function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  // Remove ```json or ``` opening fence
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '');
  // Remove closing ``` fence
  cleaned = cleaned.replace(/\n?\s*```$/, '');
  return cleaned.trim();
}

export async function sendAIRequest(
  provider: AIProvider,
  apiKey: string,
  request: AIRequest,
  options?: { model?: string; ollamaApiKey?: string },
): Promise<string> {
  const endpoints: Record<AIProvider, string> = {
    anthropic: '/api/ai/anthropic',
    openai: '/api/ai/openai',
    ollama: '/api/ai/ollama',
  };

  const endpoint = endpoints[provider];

  const body: Record<string, string | undefined> = {
    apiKey,
    systemPrompt: request.systemPrompt,
    userMessage: request.userMessage,
    model: options?.model,
  };

  // For Ollama, apiKey is the base URL. Also pass optional cloud API key.
  if (provider === 'ollama') {
    body.baseUrl = apiKey;
    body.ollamaApiKey = options?.ollamaApiKey;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `AI request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.content;
}
