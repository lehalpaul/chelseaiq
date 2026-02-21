"use client";

import { useEffect, useState } from "react";

interface AnalysisStepProps {
  title: string;
  content: string;
  isStreaming: boolean;
}

export function AnalysisStep({ title, content, isStreaming }: AnalysisStepProps) {
  const [expanded, setExpanded] = useState(isStreaming);

  useEffect(() => {
    setExpanded(isStreaming);
  }, [isStreaming]);

  return (
    <button
      type="button"
      onClick={() => setExpanded((prev) => !prev)}
      aria-expanded={expanded}
      className="ai-panel fade-in-up block w-full rounded-xl p-3.5 text-left transition hover:border-accent/35 sm:rounded-2xl sm:p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Analysis
        </p>
        <span
          className={`text-xs text-muted-foreground transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        >
          v
        </span>
      </div>
      <p className="mt-1 text-sm font-semibold text-foreground sm:text-base">{title}</p>
      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          expanded ? "mt-2 max-h-80 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <p className="text-sm leading-relaxed text-muted-foreground">{content}</p>
      </div>
    </button>
  );
}
