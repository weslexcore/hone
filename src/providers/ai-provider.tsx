"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { AIProvider, AIConfig } from "@/types/ai";
import {
  getApiKey,
  getOllamaModel,
  getOllamaApiKey,
  getProviderModel,
  getActiveProvider,
  setActiveProvider,
} from "@/lib/storage/api-keys";
import { DEFAULT_MODELS } from "@/lib/constants/models";
import { sendAIRequest, fetchServerStatus } from "@/lib/ai/client";
import { useAuth } from "@/providers/auth-provider";

interface ServerKeyStatus {
  anthropic: boolean;
  openai: boolean;
  ollama: boolean;
}

interface AIContextValue {
  config: AIConfig;
  setProvider: (provider: AIProvider) => void;
  setEnabledGlobally: (enabled: boolean) => void;
  /** Whether the user can make AI requests (own key or shared key available) */
  hasKey: () => boolean;
  /** Whether the current request will use the server's shared key */
  isUsingSharedKey: boolean;
  /** Which server-side providers are configured */
  serverKeys: ServerKeyStatus;
  sendRequest: (systemPrompt: string, userMessage: string) => Promise<string>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

const AIContext = createContext<AIContextValue | null>(null);

export function AIProviderComponent({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [config, setConfig] = useState<AIConfig>({
    provider: "anthropic",
    model: DEFAULT_MODELS.anthropic,
    enabledGlobally: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverKeys, setServerKeys] = useState<ServerKeyStatus>({
    anthropic: false,
    openai: false,
    ollama: false,
  });

  // Restore persisted provider from localStorage after hydration
  useEffect(() => {
    const persisted = getActiveProvider();
    if (persisted !== "anthropic") {
      setConfig((prev) => ({
        ...prev,
        provider: persisted,
        model: DEFAULT_MODELS[persisted],
      }));
    }
  }, []);

  // Fetch which server-side keys are available
  useEffect(() => {
    fetchServerStatus().then((status) => {
      setServerKeys({
        anthropic: status.anthropic,
        openai: status.openai,
        ollama: status.ollama,
      });
    }).catch(() => {
      // Server status unavailable — shared keys won't be offered
    });
  }, []);

  const setProvider = useCallback((provider: AIProvider) => {
    setActiveProvider(provider);
    setConfig((prev) => ({
      ...prev,
      provider,
      model: DEFAULT_MODELS[provider],
    }));
  }, []);

  const setEnabledGlobally = useCallback((enabled: boolean) => {
    setConfig((prev) => ({ ...prev, enabledGlobally: enabled }));
  }, []);

  // Determine if the user has their own key for the current provider
  const hasOwnKey = useCallback(() => {
    if (config.provider === "ollama") return true; // Ollama doesn't need a key
    return getApiKey(config.provider) !== null;
  }, [config.provider]);

  // Whether the current provider will use the shared server key
  const isUsingSharedKey = !hasOwnKey() && Boolean(user) && serverKeys[config.provider];

  const hasKey = useCallback(() => {
    if (hasOwnKey()) return true;
    // Authenticated user with a server key available for this provider
    return Boolean(user) && serverKeys[config.provider];
  }, [hasOwnKey, user, serverKeys, config.provider]);

  const sendRequest = useCallback(
    async (systemPrompt: string, userMessage: string): Promise<string> => {
      const apiKey = getApiKey(config.provider);
      const useShared = !apiKey && config.provider !== "ollama" && Boolean(user) && serverKeys[config.provider];
      const ollamaUseShared = config.provider === "ollama" && !getOllamaApiKey() && Boolean(user) && serverKeys.ollama;

      if (!apiKey && config.provider !== "ollama" && !useShared) {
        throw new Error("No API key configured. Sign in to use the shared key, or add your own.");
      }

      setIsLoading(true);
      setError(null);
      try {
        let model: string;
        if (config.provider === "ollama") {
          model = getOllamaModel();
        } else {
          model = getProviderModel(config.provider) || DEFAULT_MODELS[config.provider];
        }

        const shouldUseShared = useShared || ollamaUseShared;

        const options =
          config.provider === "ollama"
            ? { model, ollamaApiKey: getOllamaApiKey() ?? undefined, useSharedKey: shouldUseShared }
            : { model, useSharedKey: shouldUseShared };

        const result = await sendAIRequest(
          config.provider,
          apiKey || "",
          { type: "suggestion", systemPrompt, userMessage },
          options,
        );
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "AI request failed";
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [config.provider, user, serverKeys],
  );

  const clearError = useCallback(() => setError(null), []);

  return (
    <AIContext.Provider
      value={{
        config,
        setProvider,
        setEnabledGlobally,
        hasKey,
        isUsingSharedKey,
        serverKeys,
        sendRequest,
        isLoading,
        error,
        clearError,
      }}
    >
      {children}
    </AIContext.Provider>
  );
}

export function useAI() {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error("useAI must be used within AIProvider");
  return ctx;
}
