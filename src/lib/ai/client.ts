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

/**
 * Check if a URL points to localhost / the user's machine.
 * When deployed to the web, server-side routes can't reach localhost —
 * so we call local Ollama directly from the browser instead.
 */
function isLocalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local')
    );
  } catch {
    return false;
  }
}

/**
 * Call local Ollama directly from the browser (no server proxy needed).
 */
async function sendOllamaDirectRequest(
  baseUrl: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  ollamaApiKey?: string,
): Promise<string> {
  const ollamaUrl = baseUrl.replace(/\/+$/, '');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (ollamaApiKey) {
    headers['Authorization'] = `Bearer ${ollamaApiKey}`;
  }

  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model || 'llama3.2',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error');
    throw new Error(`Ollama error (${response.status}): ${text}`);
  }

  const data = await response.json();
  return data.message?.content ?? '';
}

/**
 * Fetch models from a local Ollama instance directly from the browser.
 */
export async function fetchOllamaModelsDirect(
  baseUrl: string,
  ollamaApiKey?: string,
): Promise<string[]> {
  const ollamaUrl = baseUrl.replace(/\/+$/, '');

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
    throw new Error(`Ollama error (${response.status}): ${text}`);
  }

  const data = await response.json();
  return (data.models || [])
    .map((m: { name: string }) => m.name)
    .sort((a: string, b: string) => a.localeCompare(b));
}

export async function sendAIRequest(
  provider: AIProvider,
  apiKey: string,
  request: AIRequest,
  options?: { model?: string; ollamaApiKey?: string },
): Promise<string> {
  // For Ollama with a local URL, call directly from the browser
  // (server-side proxy can't reach localhost when deployed)
  if (provider === 'ollama') {
    const baseUrl = apiKey || 'http://localhost:11434';
    if (isLocalUrl(baseUrl)) {
      return sendOllamaDirectRequest(
        baseUrl,
        options?.model || 'llama3.2',
        request.systemPrompt,
        request.userMessage,
        options?.ollamaApiKey,
      );
    }
  }

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
