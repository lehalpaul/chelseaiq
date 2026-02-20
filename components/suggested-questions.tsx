"use client";

const suggestions = [
  "How did we do yesterday?",
  "Who was our top server?",
  "What were our top 10 items?",
  "Compare all locations",
  "What's our labor cost looking like?",
  "Show me the hourly breakdown",
];

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
}

export function SuggestedQuestions({ onSelect }: SuggestedQuestionsProps) {
  return (
    <div className="fade-in-up flex flex-col items-center gap-7 py-6 sm:py-10">
      <div className="max-w-xl text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
          Chelseaiq Ai
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Built for operators who move fast
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Ask in plain language and get analytics, recommendations, and
          staffing insight in one stream.
        </p>
      </div>
      <div className="grid w-full max-w-2xl grid-cols-1 gap-2.5 sm:grid-cols-2">
        {suggestions.map((q, index) => (
          <button
            key={`${index}-${q}`}
            onClick={() => onSelect(q)}
            className="ai-panel ai-ring rounded-xl px-4 py-3 text-left text-sm font-medium transition-all hover:-translate-y-0.5 hover:border-accent/35 hover:bg-accent/10 sm:rounded-2xl sm:text-[15px]"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
