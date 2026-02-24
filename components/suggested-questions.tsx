"use client";

const questionGroups = [
  {
    title: "Toast POS",
    subtitle: "Sales, labor, menu, and guest operations",
    questions: [
      "How did we do yesterday?",
      "Top server yesterday?",
      "Top 10 items yesterday?",
      "Labor cost breakdown yesterday",
      "Hourly sales breakdown yesterday",
      "Food to beverage attach rate yesterday",
    ],
  },
  {
    title: "MarginEdge",
    subtitle: "Purchasing, invoices, and vendor spend",
    questions: [
      "What did we spend yesterday?",
      "Cost trend this week",
      "Top vendors by spend this week",
      "Show finalized invoices yesterday",
      "Cost by category yesterday",
      "Daily cost trend for last 7 days",
    ],
  },
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
          Ask in plain language and get Toast operations plus MarginEdge cost
          insights in one stream.
        </p>
      </div>

      <div className="w-full max-w-4xl space-y-4">
        {questionGroups.map((group) => (
          <section key={group.title} className="ai-panel rounded-2xl p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold tracking-tight sm:text-base">
                {group.title}
              </h3>
              <p className="text-[11px] text-muted-foreground sm:text-xs">
                {group.subtitle}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {group.questions.map((q) => (
                <button
                  key={`${group.title}-${q}`}
                  onClick={() => onSelect(q)}
                  className="ai-ring rounded-xl border border-border/70 bg-background/55 px-4 py-3 text-left text-sm font-medium transition-all hover:-translate-y-0.5 hover:border-accent/35 hover:bg-accent/10 sm:rounded-2xl sm:text-[15px]"
                >
                  {q}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
