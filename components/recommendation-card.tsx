"use client";

interface RecommendationCardProps {
  recommendations: Array<{
    id: string;
    severity: string;
    title: string;
    body: string;
    category: string;
  }>;
}

const severityStyles: Record<string, string> = {
  critical: "border-l-danger bg-danger/12",
  warning: "border-l-warning bg-warning/12",
  info: "border-l-accent bg-accent/12",
};

const severityIcons: Record<string, string> = {
  critical: "!!",
  warning: "!",
  info: "i",
};

export function RecommendationCards({
  recommendations,
}: RecommendationCardProps) {
  if (!recommendations || recommendations.length === 0) return null;

  return (
    <div className="space-y-2">
      {recommendations.map((rec) => (
        <div
          key={rec.id}
          className={`rounded-xl border border-border/80 border-l-4 p-3 shadow-sm sm:rounded-2xl ${severityStyles[rec.severity] || severityStyles.info}`}
        >
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground/10 text-[11px] font-bold">
              {severityIcons[rec.severity] || "i"}
            </span>
            <div>
              <p className="text-sm font-semibold">{rec.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                {rec.body}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
