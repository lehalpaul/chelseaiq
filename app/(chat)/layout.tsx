export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-3 py-3 sm:px-5 sm:py-5">
      <div className="ai-shell ai-grid flex min-h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-2xl sm:min-h-[calc(100vh-2.5rem)] sm:rounded-3xl">
        <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-background/65 px-4 py-3 backdrop-blur-sm sm:px-6">
          <div className="flex items-center gap-3">
            <span
              aria-label="Chelseaiq Ai logo"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-sm font-semibold text-accent"
            >
              CQ
            </span>
            <div>
              <p className="text-base font-semibold leading-tight tracking-tight sm:text-lg">
                Chelseaiq Ai
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground sm:text-[11px]">
                Intelligence Workspace
              </p>
            </div>
          </div>
          <span
            role="status"
            aria-live="polite"
            className="rounded-full border border-accent/35 bg-accent/12 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-accent sm:px-3"
          >
            Agent Online
          </span>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
