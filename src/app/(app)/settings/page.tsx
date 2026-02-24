'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { useAI } from '@/providers/ai-provider';
import { useTheme } from '@/providers/theme-provider';
import {
  getApiKey,
  setApiKey,
  removeApiKey,
  getOllamaUrl,
  setOllamaUrl,
  getOllamaModel,
  setOllamaModel,
  getOllamaApiKey,
  setOllamaApiKey,
  removeOllamaApiKey,
  getProviderModel,
  setProviderModel,
} from '@/lib/storage/api-keys';
import { ANTHROPIC_MODELS, OPENAI_MODELS, type ModelOption } from '@/lib/constants/models';
import { THEMES, type ThemeId } from '@/lib/storage/theme';
import { Eye, EyeOff, Trash2, Key, Palette, Check, Server, RefreshCw, Loader2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/** Small swatch showing the theme's surface + text + accent colors */
function ThemeSwatch({ themeId }: { themeId: ThemeId }) {
  const palettes: Record<ThemeId, { bg: string; raised: string; text: string; accent: string }> = {
    default: { bg: '#1a1a1e', raised: '#232328', text: '#e8e6e3', accent: '#c9a55a' },
    'deep-black': { bg: '#000000', raised: '#0a0a0c', text: '#dcdad6', accent: '#c9a55a' },
    parchment: { bg: '#f5f0e8', raised: '#ece7dd', text: '#2c2820', accent: '#9a7b3c' },
  };
  const p = palettes[themeId];
  return (
    <div
      className="w-10 h-7 rounded border border-border overflow-hidden flex"
      style={{ background: p.bg }}
    >
      <div className="w-1/2 flex flex-col items-center justify-center gap-0.5">
        <div className="w-3 h-[2px] rounded-full" style={{ background: p.text }} />
        <div className="w-2 h-[2px] rounded-full" style={{ background: p.text, opacity: 0.5 }} />
      </div>
      <div
        className="w-1/2 flex items-end justify-center pb-1"
        style={{ background: p.raised }}
      >
        <div className="w-2 h-2 rounded-sm" style={{ background: p.accent }} />
      </div>
    </div>
  );
}

function ModelSelector({
  models,
  selected,
  onChange,
}: {
  models: ModelOption[];
  selected: string;
  onChange: (model: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeLabel = models.find((m) => m.id === selected)?.label || selected;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm text-left transition-colors hover:bg-surface-hover"
      >
        <span className="text-text-primary">{activeLabel}</span>
        <ChevronDown
          size={14}
          className={cn('text-text-muted transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-border bg-surface-raised shadow-lg">
          {models.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                onChange(m.id);
                setOpen(false);
              }}
              className={cn(
                'w-full px-3 py-2 text-sm text-left transition-colors hover:bg-surface-hover',
                selected === m.id ? 'text-accent bg-accent-muted' : 'text-text-primary'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ApiKeySection({
  provider,
  label,
  placeholder,
}: {
  provider: 'anthropic' | 'openai';
  label: string;
  placeholder: string;
}) {
  const { toast } = useToast();
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  const fallbackModels = provider === 'anthropic' ? ANTHROPIC_MODELS : OPENAI_MODELS;
  const defaultModel = fallbackModels[0].id;
  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const [availableModels, setAvailableModels] = useState<ModelOption[]>(fallbackModels);

  useEffect(() => {
    const existing = getApiKey(provider);
    if (existing) {
      setSaved(true);
      setKey(existing);
    }
    const storedModel = getProviderModel(provider);
    if (storedModel) {
      setSelectedModel(storedModel);
    }
  }, [provider]);

  const fetchModels = async () => {
    const apiKey = getApiKey(provider);
    if (!apiKey) {
      toast('Save your API key first to fetch models', 'info');
      return;
    }
    setLoadingModels(true);
    try {
      const res = await fetch(`/api/ai/${provider}/models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to fetch' }));
        toast(err.error || 'Failed to fetch models', 'error');
        return;
      }
      const data = await res.json();
      if (data.models?.length > 0) {
        setAvailableModels(data.models);
        toast(`Found ${data.models.length} models`, 'success');
      } else {
        toast('No models found', 'info');
      }
    } catch {
      toast('Failed to fetch models', 'error');
    } finally {
      setLoadingModels(false);
    }
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    setProviderModel(provider, model);
    toast(`${label} model updated`, 'success');
  };

  const handleSave = () => {
    if (!key.trim()) return;
    setApiKey(provider, key.trim());
    setSaved(true);
    toast(`${label} key saved`, 'success');
  };

  const handleRemove = () => {
    removeApiKey(provider);
    setKey('');
    setSaved(false);
    setAvailableModels(fallbackModels);
    toast(`${label} key removed`, 'info');
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <Key size={16} className="text-accent" />
        <h3 className="text-sm font-medium text-text-primary">{label}</h3>
        {saved && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-success-muted text-success uppercase">
            Configured
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={showKey ? 'text' : 'password'}
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setSaved(false);
            }}
            placeholder={placeholder}
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
          >
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        {saved ? (
          <Button variant="danger" size="icon" onClick={handleRemove} title="Remove key">
            <Trash2 size={14} />
          </Button>
        ) : (
          <Button variant="primary" onClick={handleSave} disabled={!key.trim()}>
            Save
          </Button>
        )}
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-text-muted">Model</label>
          {saved && (
            <button
              onClick={fetchModels}
              disabled={loadingModels}
              className="flex items-center gap-1 text-[10px] text-accent hover:text-accent/80 transition-colors disabled:opacity-50"
            >
              {loadingModels ? (
                <Loader2 size={10} className="animate-spin" />
              ) : (
                <RefreshCw size={10} />
              )}
              {loadingModels ? 'Loading…' : 'Fetch models'}
            </button>
          )}
        </div>
        <ModelSelector
          models={availableModels}
          selected={selectedModel}
          onChange={handleModelChange}
        />
      </div>
      <p className="text-xs text-text-muted">
        Your API key is stored locally in your browser and never sent to our servers.
      </p>
    </Card>
  );
}

function OllamaSection() {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [model, setModel] = useState('');
  const [cloudKey, setCloudKey] = useState('');
  const [hasCloudKey, setHasCloudKey] = useState(false);
  const [showCloudKey, setShowCloudKey] = useState(false);
  const [useCloud, setUseCloud] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  useEffect(() => {
    const savedUrl = getOllamaUrl();
    setUrl(savedUrl);
    setModel(getOllamaModel());
    const existingKey = getOllamaApiKey();
    if (existingKey) {
      setCloudKey(existingKey);
      setHasCloudKey(true);
    }
    // Auto-detect cloud mode from saved URL
    if (savedUrl.includes('ollama.com')) {
      setUseCloud(true);
    }
  }, []);

  const fetchModels = async () => {
    setLoadingModels(true);
    try {
      const effectiveUrl = useCloud ? 'https://ollama.com' : (url.trim() || 'http://localhost:11434');
      const body: Record<string, string | undefined> = { baseUrl: effectiveUrl };
      if (useCloud && cloudKey.trim()) {
        body.ollamaApiKey = cloudKey.trim();
      }
      const res = await fetch('/api/ai/ollama/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to fetch' }));
        toast(err.error || 'Failed to fetch models', 'error');
        return;
      }
      const data = await res.json();
      setAvailableModels(data.models || []);
      if (data.models?.length > 0) {
        setModelDropdownOpen(true);
      } else {
        toast('No models found', 'info');
      }
    } catch {
      toast('Failed to connect to Ollama', 'error');
    } finally {
      setLoadingModels(false);
    }
  };

  const handleSave = () => {
    const effectiveUrl = useCloud ? 'https://ollama.com' : (url.trim() || 'http://localhost:11434');
    setOllamaUrl(effectiveUrl);
    if (model.trim()) setOllamaModel(model.trim());
    if (useCloud && cloudKey.trim()) {
      setOllamaApiKey(cloudKey.trim());
      setHasCloudKey(true);
    }
    toast('Ollama settings saved', 'success');
  };

  const handleRemoveCloudKey = () => {
    removeOllamaApiKey();
    setCloudKey('');
    setHasCloudKey(false);
    toast('Ollama cloud key removed', 'info');
  };

  const handleToggleCloud = (enabled: boolean) => {
    setUseCloud(enabled);
    setAvailableModels([]);
    setModelDropdownOpen(false);
    if (enabled) {
      setUrl('https://ollama.com');
    } else {
      setUrl('http://localhost:11434');
    }
  };

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2">
        <Server size={16} className="text-accent" />
        <h3 className="text-sm font-medium text-text-primary">Ollama</h3>
      </div>

      {/* Local vs Cloud toggle */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm text-text-primary">Use Ollama Cloud</span>
          <p className="text-[10px] text-text-muted mt-0.5">
            Run large models without local GPU via ollama.com
          </p>
        </div>
        <Switch checked={useCloud} onChange={handleToggleCloud} />
      </div>

      <div className="space-y-2">
        {!useCloud && (
          <div>
            <label className="text-xs text-text-muted block mb-1">Server URL</label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:11434"
            />
          </div>
        )}

        {/* Model selector */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-text-muted">Model</label>
            <button
              onClick={fetchModels}
              disabled={loadingModels}
              className="flex items-center gap-1 text-[10px] text-accent hover:text-accent/80 transition-colors disabled:opacity-50"
            >
              {loadingModels ? (
                <Loader2 size={10} className="animate-spin" />
              ) : (
                <RefreshCw size={10} />
              )}
              {loadingModels ? 'Loading…' : 'Fetch models'}
            </button>
          </div>
          <div className="relative">
            {availableModels.length > 0 ? (
              <>
                <button
                  onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                  className={cn(
                    'w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm text-left transition-colors',
                    'border-border bg-surface hover:bg-surface-hover text-text-primary'
                  )}
                >
                  <span className={model ? 'text-text-primary' : 'text-text-muted'}>
                    {model || 'Select a model…'}
                  </span>
                  <ChevronDown
                    size={14}
                    className={cn(
                      'text-text-muted transition-transform',
                      modelDropdownOpen && 'rotate-180'
                    )}
                  />
                </button>
                {modelDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-surface-raised shadow-lg">
                    {availableModels.map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          setModel(m);
                          setModelDropdownOpen(false);
                        }}
                        className={cn(
                          'w-full px-3 py-2 text-sm text-left transition-colors hover:bg-surface-hover',
                          model === m ? 'text-accent bg-accent-muted' : 'text-text-primary'
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={useCloud ? 'gpt-oss:120b-cloud' : 'llama3.2'}
              />
            )}
          </div>
          <p className="text-[10px] text-text-muted mt-1">
            Click &ldquo;Fetch models&rdquo; to see available models, or type a name manually.
          </p>
        </div>

        {/* Cloud API key */}
        {useCloud && (
          <div>
            <label className="text-xs text-text-muted block mb-1">
              Ollama Cloud API Key
              {hasCloudKey && (
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-success-muted text-success uppercase">
                  Configured
                </span>
              )}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showCloudKey ? 'text' : 'password'}
                  value={cloudKey}
                  onChange={(e) => {
                    setCloudKey(e.target.value);
                    setHasCloudKey(false);
                  }}
                  placeholder="your_ollama_api_key"
                />
                <button
                  onClick={() => setShowCloudKey(!showCloudKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                >
                  {showCloudKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {hasCloudKey && (
                <Button variant="danger" size="icon" onClick={handleRemoveCloudKey} title="Remove key">
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
            <p className="text-[10px] text-text-muted mt-1">
              Get your API key from ollama.com settings
            </p>
          </div>
        )}

        <Button variant="primary" size="sm" onClick={handleSave}>
          Save
        </Button>
      </div>

      <p className="text-xs text-text-muted">
        {useCloud
          ? 'Run models in the cloud via Ollama. Requires an ollama.com account and API key.'
          : 'Run models locally with Ollama. Make sure the Ollama server is running before using AI features.'}
      </p>
    </Card>
  );
}

export default function SettingsPage() {
  const { config, setProvider, setEnabledGlobally } = useAI();
  const { theme, setTheme } = useTheme();

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <h1 className="text-2xl font-semibold text-text-primary mb-2">Settings</h1>
        <p className="text-sm text-text-muted mb-8">Configure your writing environment</p>

        {/* Theme */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">
            <span className="flex items-center gap-2">
              <Palette size={14} />
              Theme
            </span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {THEMES.map((t) => {
              const isActive = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={cn(
                    'relative flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
                    isActive
                      ? 'border-accent bg-accent-muted'
                      : 'border-border hover:border-border hover:bg-surface-hover'
                  )}
                >
                  <ThemeSwatch themeId={t.id} />
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        'text-sm font-medium',
                        isActive ? 'text-accent' : 'text-text-primary'
                      )}
                    >
                      {t.label}
                    </p>
                    <p className="text-[10px] text-text-muted leading-snug mt-0.5">
                      {t.description}
                    </p>
                  </div>
                  {isActive && (
                    <Check size={14} className="text-accent shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* AI Provider */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">
            AI Provider
          </h2>

          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-primary">Enable AI features</span>
              <Switch checked={config.enabledGlobally} onChange={setEnabledGlobally} />
            </div>

            <div>
              <label className="text-xs text-text-muted block mb-2">Active Provider</label>
              <div className="flex gap-2">
                {([
                  { id: 'anthropic', label: 'Anthropic (Claude)' },
                  { id: 'openai', label: 'OpenAI (GPT-4o)' },
                  { id: 'ollama', label: 'Ollama (Local)' },
                ] as const).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setProvider(p.id)}
                    className={cn(
                      'flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
                      config.provider === p.id
                        ? 'border-accent bg-accent-muted text-accent'
                        : 'border-border text-text-secondary hover:border-border hover:bg-surface-hover'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </section>

        {/* API Keys / Provider Config */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">
            {config.provider === 'ollama' ? 'Ollama Configuration' : 'API Keys'}
          </h2>
          <div className="space-y-4">
            {config.provider === 'ollama' ? (
              <OllamaSection />
            ) : (
              <>
                <ApiKeySection
                  provider="anthropic"
                  label="Anthropic"
                  placeholder="sk-ant-..."
                />
                <ApiKeySection
                  provider="openai"
                  label="OpenAI"
                  placeholder="sk-..."
                />
              </>
            )}
          </div>
        </section>

        {/* Info */}
        <section>
          <Card className="bg-accent-muted border-accent/20">
            <h3 className="text-sm font-medium text-accent mb-1">No API key? No problem.</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Without an API key, you can still use all AI features via the &ldquo;Copy for AI&rdquo; button.
              It copies a formatted prompt to your clipboard that you can paste into Claude.ai,
              ChatGPT, or any other AI assistant. You can also run models locally with Ollama.
            </p>
          </Card>
        </section>
      </motion.div>
    </div>
  );
}
