"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Loader2, Search, Copy, Download, Save, Wand2, Check, Library, Trash2, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge, Input, Label, Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import type {
  AnalysisResult, ContextMode, GeneratedPrompt, LLMProvider, Provider, PromptVariant,
} from "@/lib/types";
import { SettingsManager } from "@/components/settings-manager";
import { loadSettings, configuredProviders } from "@/lib/settings";
import { ALL_LLM_PROVIDERS } from "@/lib/llm/providers";

const MODES: { id: ContextMode; label: string; blurb: string }[] = [
  { id: "quick", label: "Quick", blurb: "README + tree + metadata" },
  { id: "standard", label: "Standard", blurb: "+ key configs & stack" },
  { id: "deep", label: "Deep", blurb: "+ critical file contents" },
  { id: "ultra", label: "Ultra", blurb: "full modular breakdown" },
];

const VARIANTS: { id: PromptVariant; label: string }[] = [
  { id: "vibe", label: "Vibe Coding" },
  { id: "system", label: "System Prompt" },
  { id: "rebuild", label: "Step-by-step Rebuild" },
  { id: "fork", label: "Fork & Improve" },
];

const PROVIDERS: Provider[] = ["github", "gitlab", "bitbucket", "gitea"];
const EXPORTS = [
  { f: "md", label: "Markdown" }, { f: "json", label: "JSON" }, { f: "txt", label: "Plain text" },
  { f: "claude", label: "CLAUDE.md" }, { f: "cursor", label: ".cursorrules" },
];

export function Studio() {
  const [url, setUrl] = React.useState("");
  const [provider, setProvider] = React.useState<Provider>("github");
  const [host, setHost] = React.useState("");
  const [token, setToken] = React.useState("");
  const [subpath, setSubpath] = React.useState("");
  const [refName, setRefName] = React.useState("");
  const [mode, setMode] = React.useState<ContextMode>("standard");
  const [advanced, setAdvanced] = React.useState(false);

  const [analysis, setAnalysis] = React.useState<AnalysisResult | null>(null);
  const [prompts, setPrompts] = React.useState<GeneratedPrompt[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);

  const [useLlm, setUseLlm] = React.useState(false);
  const [llmProvider, setLlmProvider] = React.useState<LLMProvider>("ollama");
  const [available, setAvailable] = React.useState<LLMProvider[]>([]);

  React.useEffect(() => {
    fetch("/api/generate").then((r) => r.json()).then((d) => {
      setAvailable(d.availableProviders ?? []);
      if (d.availableProviders?.[0]) setLlmProvider(d.availableProviders[0]);
    }).catch(() => {});
  }, []);

  const [localProviders, setLocalProviders] = React.useState<LLMProvider[]>([]);
  React.useEffect(() => {
    const sync = () => setLocalProviders(configuredProviders());
    sync();
    window.addEventListener("settings:refresh", sync);
    return () => window.removeEventListener("settings:refresh", sync);
  }, []);

  const selectableProviders = React.useMemo<LLMProvider[]>(
    () => Array.from(new Set([...available, ...localProviders, ...ALL_LLM_PROVIDERS])),
    [available, localProviders],
  );

  async function analyze() {
    if (!url.trim()) return toast.error("Paste a repository URL first");
    setLoading(true);
    setPrompts([]);
    setAnalysis(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url, mode, provider,
          host: host || undefined, token: token || undefined,
          subpath: subpath || undefined, ref: refName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setAnalysis(data.analysis);
      toast.success(`Analysed ${data.analysis.meta.fullName}`);
      await generate(data.analysis);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function generate(a: AnalysisResult) {
    setGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          analysis: a, mode, variants: VARIANTS.map((v) => v.id),
          useLlm, llmProvider,
          ...(() => {
            const c = loadSettings()[llmProvider];
            return c ? { llmApiKey: c.apiKey, llmBaseUrl: c.baseUrl, llmModel: c.model } : {};
          })(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setPrompts(data.prompts);
      if (data.llmError) toast.warning(`LLM summary skipped: ${data.llmError}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
  }

  const est = analysis?.tokenEstimate.byMode[mode];

  return (
    <div className="container max-w-5xl space-y-6 pb-16">
      {/* ─── input card ─── */}
      <Card className="glow">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="https://github.com/owner/repo  (or owner/repo, or a subfolder URL)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && analyze()}
              className="font-mono"
            />
            <Button onClick={analyze} disabled={loading || generating} className="shrink-0">
              {loading ? <Loader2 className="animate-spin" /> : <Search />}
              Analyse
            </Button>
          </div>

          {/* modes */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  mode === m.id ? "border-primary bg-primary/5" : "hover:bg-accent",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{m.label}</span>
                  {mode === m.id && <Check className="size-4 text-primary" />}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{m.blurb}</p>
                {est !== undefined && mode === m.id && (
                  <p className="mt-1 text-xs text-primary">~{est.toLocaleString()} tokens</p>
                )}
              </button>
            ))}
          </div>

          {/* advanced */}
          <button
            onClick={() => setAdvanced((v) => !v)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={cn("size-4 transition-transform", advanced && "rotate-180")} />
            Advanced (provider, branch, subfolder, private token, AI summary)
          </button>

          {advanced && (
            <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Provider</Label>
                <div className="flex flex-wrap gap-1">
                  {PROVIDERS.map((p) => (
                    <Button key={p} size="sm" variant={provider === p ? "default" : "outline"}
                      onClick={() => setProvider(p)}>{p}</Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Host (self-hosted GitLab / Gitea)</Label>
                <Input placeholder="https://git.mycorp.dev" value={host} onChange={(e) => setHost(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Branch / tag / commit</Label>
                <Input placeholder="main" value={refName} onChange={(e) => setRefName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Subfolder</Label>
                <Input placeholder="apps/web" value={subpath} onChange={(e) => setSubpath(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Access token (private repos — never stored)</Label>
                <Input type="password" placeholder="ghp_..." value={token} onChange={(e) => setToken(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>AI architecture summary (Deep/Ultra)</Label>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant={useLlm ? "default" : "outline"}
                    onClick={() => setUseLlm((v) => !v)}>
                    {useLlm ? "On" : "Off"}
                  </Button>
                  {useLlm && (
                    <select
                      className="h-8 rounded-md border bg-background px-2 text-sm"
                      value={llmProvider}
                      onChange={(e) => setLlmProvider(e.target.value as LLMProvider)}
                    >
                      {selectableProviders.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  )}
                </div>
                {useLlm && !available.includes(llmProvider) && (
                  <p className="text-xs text-muted-foreground">No key for {llmProvider} in env — add one under “API Keys &amp; Base URLs” below.</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {analysis && <Insights analysis={analysis} />}

      {(generating || prompts.length > 0) && (
        <Results
          prompts={prompts}
          generating={generating}
          analysis={analysis}
          mode={mode}
          provider={provider}
        />
      )}

      <SettingsManager />

      <LibraryPanel />
    </div>
  );
}

// ─── insights ────────────────────────────────────────────────────────────────

function Chips({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-1">
        {items.map((i) => <Badge key={i}>{i}</Badge>)}
      </div>
    </div>
  );
}

function Insights({ analysis }: { analysis: AnalysisResult }) {
  const i = analysis.insights;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {analysis.meta.fullName}
          <Badge variant="muted">{analysis.meta.stars}★</Badge>
        </CardTitle>
        <CardDescription>{analysis.meta.description ?? "No description"}</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Chips title="Languages" items={i.languages.map((l) => `${l.name} ${l.share}%`)} />
        <Chips title="Frameworks" items={i.frameworks} />
        <Chips title="Architecture" items={i.architecture} />
        <Chips title="Data layer" items={i.databases} />
        <Chips title="Testing" items={i.testing} />
        <Chips title="Infra" items={[...i.infra, ...i.cicd]} />
        {i.monorepo.isMonorepo && <Chips title="Monorepo packages" items={i.monorepo.packages} />}
        <Chips title="Entry points" items={i.entryPoints} />
      </CardContent>
    </Card>
  );
}

// ─── results ─────────────────────────────────────────────────────────────────

function Results({
  prompts, generating, analysis, mode, provider,
}: {
  prompts: GeneratedPrompt[]; generating: boolean;
  analysis: AnalysisResult | null; mode: ContextMode; provider: Provider;
}) {
  const [copied, setCopied] = React.useState<string | null>(null);

  async function copy(p: GeneratedPrompt) {
    await navigator.clipboard.writeText(p.content);
    setCopied(p.variant);
    setTimeout(() => setCopied(null), 1500);
    toast.success("Copied to clipboard");
  }

  async function save(p: GeneratedPrompt) {
    if (!analysis) return;
    const res = await fetch("/api/library", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        repoFullName: analysis.meta.fullName, repoUrl: analysis.meta.url, provider,
        mode, variant: p.variant, title: p.title, content: p.content, tokens: p.tokens,
        insights: analysis.insights,
      }),
    });
    if (res.ok) { toast.success("Saved to library"); window.dispatchEvent(new Event("library:refresh")); }
    else toast.error("Save failed");
  }

  async function exportAs(format: string) {
    if (!analysis) return;
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ format, repoFullName: analysis.meta.fullName, prompts }),
    });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? `gitvibe.${format}`;
    a.click();
  }

  if (generating && !prompts.length) {
    return (
      <Card><CardContent className="flex items-center gap-2 py-10 text-muted-foreground">
        <Loader2 className="animate-spin" /> Generating prompt variants…
      </CardContent></Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2"><Wand2 className="size-5 text-primary" /> Generated prompts</CardTitle>
        <div className="flex flex-wrap gap-1">
          {EXPORTS.map((e) => (
            <Button key={e.f} size="sm" variant="outline" onClick={() => exportAs(e.f)}>
              <Download /> {e.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={prompts[0]?.variant}>
          <TabsList className="flex-wrap">
            {prompts.map((p) => (
              <TabsTrigger key={p.variant} value={p.variant}>
                {p.title} <span className="ml-1 text-xs opacity-60">~{p.tokens.toLocaleString()}t</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {prompts.map((p) => (
            <TabsContent key={p.variant} value={p.variant}>
              <div className="mb-2 flex gap-2">
                <Button size="sm" onClick={() => copy(p)}>
                  {copied === p.variant ? <Check /> : <Copy />} Copy
                </Button>
                <Button size="sm" variant="outline" onClick={() => save(p)}><Save /> Save</Button>
              </div>
              <pre className="max-h-[60vh] overflow-auto rounded-lg border bg-muted/40 p-4 text-xs leading-relaxed whitespace-pre-wrap">
                {p.content}
              </pre>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ─── library ─────────────────────────────────────────────────────────────────

function LibraryPanel() {
  const [items, setItems] = React.useState<any[]>([]);
  const [open, setOpen] = React.useState(false);

  const load = React.useCallback(() => {
    fetch("/api/library").then((r) => r.json()).then((d) => setItems(d.prompts ?? [])).catch(() => {});
  }, []);
  React.useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener("library:refresh", h);
    return () => window.removeEventListener("library:refresh", h);
  }, [load]);

  async function del(id: string) {
    await fetch(`/api/library?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <Card>
      <CardHeader className="cursor-pointer flex-row items-center justify-between space-y-0" onClick={() => setOpen((v) => !v)}>
        <CardTitle className="flex items-center gap-2"><Library className="size-5" /> Prompt Library ({items.length})</CardTitle>
        <ChevronDown className={cn("size-5 transition-transform", open && "rotate-180")} />
      </CardHeader>
      {open && (
        <CardContent className="space-y-2">
          {!items.length && <p className="text-sm text-muted-foreground">Nothing saved yet.</p>}
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{it.repoFullName} · {it.title}</p>
                <p className="text-xs text-muted-foreground">{it.mode} · ~{it.tokens.toLocaleString()} tokens</p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(it.content); toast.success("Copied"); }}>
                  <Copy />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => del(it.id)}><Trash2 /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
