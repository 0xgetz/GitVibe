"use client";

import * as React from "react";
import { toast } from "sonner";
import { KeyRound, ChevronDown, Check, Trash2, Eye, EyeOff, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Input, Label } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import type { LLMProvider } from "@/lib/types";
import { PROVIDER_META, ALL_LLM_PROVIDERS } from "@/lib/llm/providers";
import {
  loadSettings, setProviderConfig, clearProviderConfig, isConfigured, type LLMSettings,
} from "@/lib/settings";

/**
 * API key & base URL manager — lets the user store per-provider LLM credentials
 * locally (browser only) so AI summaries work without editing .env on the server.
 */
export function SettingsManager() {
  const [open, setOpen] = React.useState(false);
  const [settings, setSettings] = React.useState<LLMSettings>({});

  React.useEffect(() => {
    setSettings(loadSettings());
    const h = () => setSettings(loadSettings());
    window.addEventListener("settings:refresh", h);
    return () => window.removeEventListener("settings:refresh", h);
  }, []);

  const configuredCount = ALL_LLM_PROVIDERS.filter((p) => isConfigured(p, settings)).length;

  return (
    <Card>
      <CardHeader
        className="cursor-pointer flex-row items-center justify-between space-y-0"
        onClick={() => setOpen((v) => !v)}
      >
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-5 text-primary" /> API Keys &amp; Base URLs
          {configuredCount > 0 && <Badge variant="muted">{configuredCount} configured</Badge>}
        </CardTitle>
        <ChevronDown className={cn("size-5 transition-transform", open && "rotate-180")} />
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Stored in your browser only — never uploaded or saved on the server. Keys travel with the
            generate request when you pick that provider. Leave a field blank to use the server default.
          </p>
          {ALL_LLM_PROVIDERS.map((p) => (
            <ProviderRow key={p} provider={p} config={settings[p] ?? {}} onChange={setSettings} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

function ProviderRow({
  provider, config, onChange,
}: {
  provider: LLMProvider;
  config: { apiKey?: string; baseUrl?: string; model?: string };
  onChange: (s: LLMSettings) => void;
}) {
  const meta = PROVIDER_META[provider];
  const [apiKey, setApiKey] = React.useState(config.apiKey ?? "");
  const [baseUrl, setBaseUrl] = React.useState(config.baseUrl ?? "");
  const [model, setModel] = React.useState(config.model ?? "");
  const [reveal, setReveal] = React.useState(false);
  const configured = isConfigured(provider, { [provider]: config });

  React.useEffect(() => {
    setApiKey(config.apiKey ?? "");
    setBaseUrl(config.baseUrl ?? "");
    setModel(config.model ?? "");
  }, [config.apiKey, config.baseUrl, config.model]);

  function save() {
    if (meta.needsKey && !apiKey.trim() && !baseUrl.trim()) {
      return toast.error(`${meta.label} needs an API key`);
    }
    onChange(setProviderConfig(provider, { apiKey, baseUrl, model }));
    toast.success(`${meta.label} saved`);
  }

  function clear() {
    onChange(clearProviderConfig(provider));
    setApiKey(""); setBaseUrl(""); setModel("");
    toast.success(`${meta.label} cleared`);
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{meta.label}</span>
          {configured && (
            <Badge variant="default" className="gap-1">
              <Check className="size-3" /> set
            </Badge>
          )}
          {!meta.needsKey && <Badge variant="muted">no key</Badge>}
        </div>
        {meta.keysUrl && (
          <a
            href={meta.keysUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            get key <ExternalLink className="size-3" />
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {meta.needsKey && (
          <div className="space-y-1">
            <Label className="text-xs">API key</Label>
            <div className="relative">
              <Input
                type={reveal ? "text" : "password"}
                placeholder={meta.keyPlaceholder}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="pr-9 font-mono"
              />
              <button
                type="button"
                onClick={() => setReveal((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={reveal ? "Hide" : "Show"}
              >
                {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-xs">Base URL</Label>
          <Input
            placeholder={meta.defaultBaseUrl}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="font-mono"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Model</Label>
          <Input
            placeholder={meta.defaultModel}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="font-mono"
          />
        </div>
      </div>

      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={save}>Save</Button>
        {configured && (
          <Button size="sm" variant="ghost" onClick={clear}>
            <Trash2 className="size-4" /> Clear
          </Button>
        )}
      </div>
    </div>
  );
}
