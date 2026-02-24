'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { AIProvider, AIConfig } from '@/types/ai';
import { getApiKey, getOllamaModel, getOllamaApiKey, getProviderModel } from '@/lib/storage/api-keys';
import { DEFAULT_MODELS } from '@/lib/constants/models';
import { sendAIRequest } from '@/lib/ai/client';

interface AIContextValue {
  config: AIConfig;
  setProvider: (provider: AIProvider) => void;
  setEnabledGlobally: (enabled: boolean) => void;
  hasKey: () => boolean;
  sendRequest: (systemPrompt: string, userMessage: string) => Promise<string>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

const AIContext = createContext<AIContextValue | null>(null);

export function AIProviderComponent({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AIConfig>({
    provider: 'anthropic',
    model: DEFAULT_MODELS.anthropic,
    enabledGlobally: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setProvider = useCallback((provider: AIProvider) => {
    setConfig((prev) => ({
      ...prev,
      provider,
      model: DEFAULT_MODELS[provider],
    }));
  }, []);

  const setEnabledGlobally = useCallback((enabled: boolean) => {
    setConfig((prev) => ({ ...prev, enabledGlobally: enabled }));
  }, []);

  const hasKey = useCallback(() => {
    if (config.provider === 'ollama') return true; // Ollama doesn't need a key
    return getApiKey(config.provider) !== null;
  }, [config.provider]);

  const sendRequest = useCallback(
    async (systemPrompt: string, userMessage: string): Promise<string> => {
      const apiKey = getApiKey(config.provider);
      if (!apiKey && config.provider !== 'ollama') {
        throw new Error('No API key configured');
      }

      setIsLoading(true);
      setError(null);
      try {
        // Resolve the model: check localStorage for user preference, fall back to default
        let model: string;
        if (config.provider === 'ollama') {
          model = getOllamaModel();
        } else {
          model = getProviderModel(config.provider) || DEFAULT_MODELS[config.provider];
        }

        const options = config.provider === 'ollama'
          ? { model, ollamaApiKey: getOllamaApiKey() ?? undefined }
          : { model };

        const result = await sendAIRequest(
          config.provider,
          apiKey || '',
          { type: 'suggestion', systemPrompt, userMessage },
          options,
        );
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'AI request failed';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [config.provider]
  );

  const clearError = useCallback(() => setError(null), []);

  return (
    <AIContext.Provider
      value={{
        config,
        setProvider,
        setEnabledGlobally,
        hasKey,
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
  if (!ctx) throw new Error('useAI must be used within AIProvider');
  return ctx;
}
