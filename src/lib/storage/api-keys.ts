const STORAGE_KEY_ANTHROPIC = "hone_ak_anthropic";
const STORAGE_KEY_OPENAI = "hone_ak_openai";
const STORAGE_KEY_ANTHROPIC_MODEL = "hone_model_anthropic";
const STORAGE_KEY_OPENAI_MODEL = "hone_model_openai";
const STORAGE_KEY_OLLAMA_URL = "hone_ollama_url";
const STORAGE_KEY_OLLAMA_MODEL = "hone_ollama_model";
const STORAGE_KEY_OLLAMA_API_KEY = "hone_ollama_api_key";

function isBrowser() {
  return typeof window !== "undefined";
}

export function setApiKey(provider: "anthropic" | "openai", key: string): void {
  if (!isBrowser()) return;
  const storageKey = provider === "anthropic" ? STORAGE_KEY_ANTHROPIC : STORAGE_KEY_OPENAI;
  localStorage.setItem(storageKey, btoa(key));
}

export function getApiKey(provider: "anthropic" | "openai" | "ollama"): string | null {
  if (!isBrowser()) return null;
  if (provider === "ollama") {
    // For Ollama, return the URL as the "key" (always configured)
    return getOllamaUrl();
  }
  const storageKey = provider === "anthropic" ? STORAGE_KEY_ANTHROPIC : STORAGE_KEY_OPENAI;
  const stored = localStorage.getItem(storageKey);
  return stored ? atob(stored) : null;
}

export function removeApiKey(provider: "anthropic" | "openai"): void {
  if (!isBrowser()) return;
  const storageKey = provider === "anthropic" ? STORAGE_KEY_ANTHROPIC : STORAGE_KEY_OPENAI;
  localStorage.removeItem(storageKey);
}

export function hasApiKey(provider: "anthropic" | "openai" | "ollama"): boolean {
  if (!isBrowser()) return false;
  if (provider === "ollama") {
    // Ollama is always "configured" (defaults to localhost)
    return true;
  }
  const storageKey = provider === "anthropic" ? STORAGE_KEY_ANTHROPIC : STORAGE_KEY_OPENAI;
  return localStorage.getItem(storageKey) !== null;
}

// --- Model selection for Anthropic & OpenAI ---

export function getProviderModel(provider: "anthropic" | "openai"): string | null {
  if (!isBrowser()) return null;
  const storageKey =
    provider === "anthropic" ? STORAGE_KEY_ANTHROPIC_MODEL : STORAGE_KEY_OPENAI_MODEL;
  return localStorage.getItem(storageKey);
}

export function setProviderModel(provider: "anthropic" | "openai", model: string): void {
  if (!isBrowser()) return;
  const storageKey =
    provider === "anthropic" ? STORAGE_KEY_ANTHROPIC_MODEL : STORAGE_KEY_OPENAI_MODEL;
  localStorage.setItem(storageKey, model);
}

// --- Ollama-specific ---

export function getOllamaUrl(): string {
  if (!isBrowser()) return "http://localhost:11434";
  return localStorage.getItem(STORAGE_KEY_OLLAMA_URL) || "http://localhost:11434";
}

export function setOllamaUrl(url: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEY_OLLAMA_URL, url);
}

export function getOllamaModel(): string {
  if (!isBrowser()) return "llama3.2";
  return localStorage.getItem(STORAGE_KEY_OLLAMA_MODEL) || "llama3.2";
}

export function setOllamaModel(model: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEY_OLLAMA_MODEL, model);
}

/** Ollama Cloud API key (optional — only needed for cloud models via ollama.com) */
export function getOllamaApiKey(): string | null {
  if (!isBrowser()) return null;
  const stored = localStorage.getItem(STORAGE_KEY_OLLAMA_API_KEY);
  return stored ? atob(stored) : null;
}

export function setOllamaApiKey(key: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEY_OLLAMA_API_KEY, btoa(key));
}

export function removeOllamaApiKey(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(STORAGE_KEY_OLLAMA_API_KEY);
}
