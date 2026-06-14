import { Studio } from "@/components/studio";
import { ThemeToggle } from "@/components/theme-provider";
import { Github, Sparkles } from "lucide-react";

export default function Page() {
  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <span className="text-lg font-bold gradient-text">GitVibe</span>
            <span className="ml-2 hidden text-sm text-muted-foreground sm:inline">
              repo → optimal AI coding prompt
            </span>
          </div>
          <div className="flex items-center gap-1">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent"
              aria-label="Source"
            >
              <Github className="size-5" />
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <section className="container pt-12 pb-6 text-center">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Turn any repository into a <span className="gradient-text">prompt that rebuilds it</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          Paste a GitHub, GitLab, Bitbucket or self-hosted Git URL. GitVibe analyses the stack and
          architecture, then generates battle-tested prompts for Claude, Cursor, Grok and friends.
          100% open-source, self-hostable, zero tracking.
        </p>
      </section>

      <Studio />

      <footer className="container py-10 text-center text-sm text-muted-foreground">
        MIT licensed · self-hostable · no telemetry ·{" "}
        <span className="text-foreground">GitVibe</span>
      </footer>
    </main>
  );
}
