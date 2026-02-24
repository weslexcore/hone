"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils/cn";
import { useAI } from "@/providers/ai-provider";
import {
  getProviderModel,
  setProviderModel,
  getOllamaModel,
  setOllamaModel,
  getOllamaUrl,
  getOllamaApiKey,
} from "@/lib/storage/api-keys";
import {
  ANTHROPIC_MODELS,
  OPENAI_MODELS,
  DEFAULT_MODELS,
  type ModelOption,
} from "@/lib/constants/models";
import { fetchOllamaModelsDirect } from "@/lib/ai/client";
import { Bot, ChevronDown, Loader2 } from "lucide-react";

interface ModelSwitcherProps {
  collapsed: boolean;
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Claude",
  openai: "OpenAI",
  ollama: "Ollama",
};

export function ModelSwitcher({ collapsed }: ModelSwitcherProps) {
  const { config, hasKey } = useAI();
  const [open, setOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");
  const [ollamaModels, setOllamaModels] = useState<ModelOption[]>([]);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Sync selectedModel from localStorage when provider changes
  useEffect(() => {
    if (config.provider === "ollama") {
      setSelectedModel(getOllamaModel());
    } else {
      setSelectedModel(getProviderModel(config.provider) || DEFAULT_MODELS[config.provider]);
    }
  }, [config.provider]);

  // Click-outside to close popover
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Fetch Ollama models lazily when popover opens
  const fetchOllamaModels = useCallback(async () => {
    setOllamaLoading(true);
    try {
      const url = getOllamaUrl();
      const apiKey = getOllamaApiKey() ?? undefined;
      const models = await fetchOllamaModelsDirect(url, apiKey);
      setOllamaModels(models.map((m) => ({ id: m, label: m })));
    } catch {
      // Silently fail — user can configure in Settings
    } finally {
      setOllamaLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && config.provider === "ollama" && ollamaModels.length === 0) {
      fetchOllamaModels();
    }
  }, [open, config.provider, ollamaModels.length, fetchOllamaModels]);

  function getModelsForProvider(): ModelOption[] {
    switch (config.provider) {
      case "anthropic":
        return ANTHROPIC_MODELS;
      case "openai":
        return OPENAI_MODELS;
      case "ollama":
        return ollamaModels;
    }
  }

  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId);
    if (config.provider === "ollama") {
      setOllamaModel(modelId);
    } else {
      setProviderModel(config.provider, modelId);
    }
    setOpen(false);
  };

  const models = getModelsForProvider();
  const activeLabel = models.find((m) => m.id === selectedModel)?.label || selectedModel;
  const providerLabel = PROVIDER_LABELS[config.provider] || config.provider;
  const isConfigured = config.provider === "ollama" || hasKey();

  // Hide if AI is disabled globally
  if (!config.enabledGlobally) return null;

  const modelList = (
    <div className="py-1">
      {config.provider === "ollama" && ollamaLoading ? (
        <div className="flex items-center justify-center gap-2 py-3 text-xs text-text-muted">
          <Loader2 size={12} className="animate-spin" />
          Loading models…
        </div>
      ) : models.length === 0 ? (
        <div className="px-3 py-2 text-xs text-text-muted">
          No models available.
          <br />
          Configure in Settings.
        </div>
      ) : (
        models.map((m) => (
          <button
            key={m.id}
            onClick={() => handleSelectModel(m.id)}
            className={cn(
              "w-full px-3 py-1.5 text-xs text-left transition-colors hover:bg-surface-hover",
              selectedModel === m.id ? "text-accent bg-accent-muted" : "text-text-primary",
            )}
          >
            {m.label}
          </button>
        ))
      )}
    </div>
  );

  // Collapsed: icon-only with flyout to the right
  if (collapsed) {
    return (
      <div className="relative">
        <button
          ref={triggerRef}
          onClick={() => isConfigured && setOpen(!open)}
          className={cn(
            "flex w-full items-center justify-center rounded-lg py-2 transition-colors",
            isConfigured
              ? "text-text-muted hover:text-accent hover:bg-surface-hover"
              : "text-text-muted/40 cursor-not-allowed",
          )}
          title={
            isConfigured ? `${providerLabel}: ${activeLabel}` : "Configure API key in Settings"
          }
        >
          <Bot size={18} />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              ref={popoverRef}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute left-full bottom-0 ml-2 w-52 max-h-56 overflow-y-auto rounded-lg border border-border bg-surface-raised shadow-xl z-50"
            >
              <div className="px-3 py-1.5 border-b border-border">
                <span className="text-[10px] text-text-muted uppercase tracking-wider">
                  {providerLabel}
                </span>
              </div>
              {modelList}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Expanded: provider label + model name with popover above
  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => isConfigured && setOpen(!open)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
          isConfigured
            ? "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
            : "text-text-muted/40 cursor-not-allowed",
        )}
        title={!isConfigured ? "Configure API key in Settings" : undefined}
      >
        <Bot size={16} className="shrink-0 text-text-muted" />
        <div className="flex-1 min-w-0 text-left">
          <div className="text-[10px] text-text-muted uppercase tracking-wider leading-tight">
            {providerLabel}
          </div>
          <div className="text-xs text-text-primary truncate leading-tight">{activeLabel}</div>
        </div>
        <ChevronDown
          size={12}
          className={cn("shrink-0 text-text-muted transition-transform", open && "rotate-180")}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
            className="absolute bottom-full left-0 mb-1 w-full max-h-56 overflow-y-auto rounded-lg border border-border bg-surface-raised shadow-xl z-50"
          >
            {modelList}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
