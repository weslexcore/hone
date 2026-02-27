import type { AIProvider, AIRequest } from "@/types/ai";

/**
 * Strip markdown code fences that AI models often wrap around JSON responses.
 * Handles ```json ... ```, ``` ... ```, and leading/trailing whitespace.
 */
export function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  // Remove ```json or ``` opening fence
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "");
  // Remove closing ``` fence
  cleaned = cleaned.replace(/\n?\s*```$/, "");
  return cleaned.trim();
}

/**
 * Attempt to parse JSON that may have formatting issues from local/smaller models.
 * Handles: unquoted string values, trailing commas, missing closing braces.
 */
export function parseAIJson<T>(raw: string): T {
  const cleaned = stripCodeFences(raw);

  // Try direct parse first
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Fall through to repair
  }

  // Repair attempt: fix unquoted multi-line string values.
  // Pattern: "key": <newline><unquoted text> ... next "key" or closing brace.
  // We wrap unquoted values in double-quotes with escaped inner quotes/newlines.
  let repaired = cleaned;

  // Find "key": followed by text that isn't a valid JSON value start (" [ { digit true false null)
  repaired = repaired.replace(
    /("[\w]+"\s*:\s*)\n([\s\S]*?)(?=\n\s*["\]}])/g,
    (_match, prefix: string, value: string) => {
      const escaped = value
        .trim()
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n");
      return `${prefix}"${escaped}"`;
    },
  );

  // Remove trailing commas before } or ]
  repaired = repaired.replace(/,\s*([}\]])/g, "$1");

  try {
    return JSON.parse(repaired) as T;
  } catch {
    // Fall through
  }

  // Last resort: try to extract a JSON object from the text
  const objectMatch = repaired.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]) as T;
    } catch {
      // Fall through
    }
  }

  throw new Error("Could not parse AI response as JSON");
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
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.endsWith(".local")
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
  const ollamaUrl = baseUrl.replace(/\/+$/, "");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (ollamaApiKey) {
    headers["Authorization"] = `Bearer ${ollamaApiKey}`;
  }

  // Estimate token count (~4 chars per token) to set an adequate context window.
  // Many Ollama models default to 2048 tokens which is too small for grading prompts
  // that include the full user response.
  const estimatedTokens = Math.ceil((systemPrompt.length + userMessage.length) / 4);
  const numCtx = Math.max(8192, estimatedTokens + 2048);

  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: model || "llama3.2",
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
    throw new Error(`Ollama error (${response.status}): ${text}`);
  }

  const data = await response.json();
  return data.message?.content ?? "";
}

/**
 * Fetch models from a local Ollama instance directly from the browser.
 */
export async function fetchOllamaModelsDirect(
  baseUrl: string,
  ollamaApiKey?: string,
): Promise<string[]> {
  const ollamaUrl = baseUrl.replace(/\/+$/, "");

  const headers: Record<string, string> = {};
  if (ollamaApiKey) {
    headers["Authorization"] = `Bearer ${ollamaApiKey}`;
  }

  const response = await fetch(`${ollamaUrl}/api/tags`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    throw new Error(`Ollama error (${response.status}): ${text}`);
  }

  const data = await response.json();
  return (data.models || [])
    .map((m: { name: string }) => m.name)
    .sort((a: string, b: string) => a.localeCompare(b));
}

/**
 * Fetch which server-side AI providers are configured.
 * Cached in-memory for the lifetime of the page.
 */
let serverStatusCache: { anthropic: boolean; openai: boolean; ollama: boolean } | null = null;

export async function fetchServerStatus(): Promise<{
  anthropic: boolean;
  openai: boolean;
  ollama: boolean;
  limits: { daily: number; monthly: number };
}> {
  if (serverStatusCache) {
    return { ...serverStatusCache, limits: { daily: 30, monthly: 500 } };
  }
  const res = await fetch("/api/ai/status");
  const data = await res.json();
  serverStatusCache = {
    anthropic: data.anthropic,
    openai: data.openai,
    ollama: data.ollama,
  };
  return data;
}

export async function sendAIRequest(
  provider: AIProvider,
  apiKey: string,
  request: AIRequest,
  options?: { model?: string; ollamaApiKey?: string; useSharedKey?: boolean },
): Promise<string> {
  // For Ollama with a local URL, call directly from the browser
  // (server-side proxy can't reach localhost when deployed)
  if (provider === "ollama" && !options?.useSharedKey) {
    const baseUrl = apiKey || "http://localhost:11434";
    if (isLocalUrl(baseUrl)) {
      return sendOllamaDirectRequest(
        baseUrl,
        options?.model || "llama3.2",
        request.systemPrompt,
        request.userMessage,
        options?.ollamaApiKey,
      );
    }
  }

  const endpoints: Record<AIProvider, string> = {
    anthropic: "/api/ai/anthropic",
    openai: "/api/ai/openai",
    ollama: "/api/ai/ollama",
  };

  const endpoint = endpoints[provider];

  const body: Record<string, string | boolean | undefined> = {
    systemPrompt: request.systemPrompt,
    userMessage: request.userMessage,
    model: options?.model,
  };

  if (options?.useSharedKey) {
    // Don't send apiKey — let the server use its env var key.
    // For Ollama shared key, signal that we want the server config.
    if (provider === "ollama") {
      body.useSharedKey = true;
    }
  } else {
    // User's own key
    body.apiKey = apiKey;
    if (provider === "ollama") {
      body.baseUrl = apiKey;
      body.ollamaApiKey = options?.ollamaApiKey;
    }
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `AI request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.content;
}
