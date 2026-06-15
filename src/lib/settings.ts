"use client";

import type { LLMProvider } from "@/lib/types";
import { ALL_LLM_PROVIDERS } from "@/lib/llm/providers";

/**
 * Per-provider LLM credentials the user manages from the UI.
 *
 * These live in the browser's localStorage — they are NEVER persisted server-side.
 * The studio reads them and passes apiKey / baseUrl / model to /api/generate on each
 * request, so the key only ever travels with the request that needs it.
 */
export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export type LLMSettings = Partial<Record<LLMProvider, ProviderConfig>>;

const STORAGE_KEY = "gitvibe.llm.settings.v1";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadSettings(): LLMSettings {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as LLMSettings;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveSettings(settings: LLMSettings): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event("settings:refresh"));
  } catch {
    /* storage full / blocked — fail silently, the manager surfaces a toast */
  }
}

export function setProviderConfig(provider: LLMProvider, config: ProviderConfig): LLMSettings {
  const next = loadSettings();
  const trimmed: ProviderConfig = {
    apiKey: config.apiKey?.trim() || undefined,
    baseUrl: config.baseUrl?.trim() || undefined,
    model: config.model?.trim() || undefined,
  };
  if (!trimmed.apiKey && !trimmed.baseUrl && !trimmed.model) {
    delete next[provider];
  } else {
    next[provider] = trimmed;
  }
  saveSettings(next);
  return next;
}

export function clearProviderConfig(provider: LLMProvider): LLMSettings {
  const next = loadSettings();
  delete next[provider];
  saveSettings(next);
  return next;
}

/** A provider counts as configured once it has a key or a custom base URL. */
export function isConfigured(provider: LLMProvider, settings = loadSettings()): boolean {
  const c = settings[provider];
  return Boolean(c && (c.apiKey || c.baseUrl));
}

/** Providers usable purely from local settings (env-configured ones come from the API). */
export function configuredProviders(settings = loadSettings()): LLMProvider[] {
  return ALL_LLM_PROVIDERS.filter((p) => isConfigured(p, settings));
}
