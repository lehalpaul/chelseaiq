"use client";

import { formatCurrencyPrecise } from "@/lib/formatters";

interface BreakdownRow {
  rank?: number;
  name: string;
  cost: number;
  pct?: number;
}

interface CostBreakdownCardProps {
  title: string;
  items: BreakdownRow[];
}

export function CostBreakdownCard({ title, items }: CostBreakdownCardProps) {
  if (!items || items.length === 0) {
    return (
      <div className="ai-panel rounded-xl p-3.5 text-sm text-muted-foreground sm:rounded-2xl sm:p-4">
        No breakdown data available.
      </div>
    );
  }

  const max = Math.max(...items.map((item) => item.cost));

  return (
    <div className="ai-panel rounded-xl p-3.5 sm:rounded-2xl sm:p-4">
      <p className="mb-3 text-sm font-semibold">{title}</p>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.name} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm text-muted-foreground">
                {item.rank ? `${item.rank}. ` : ""}
                {item.name}
              </span>
              <span className="shrink-0 text-sm font-medium">
                {formatCurrencyPrecise(item.cost)}
                {typeof item.pct === "number" ? ` (${item.pct.toFixed(1)}%)` : ""}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-muted">
              <div
                className="h-full rounded bg-accent"
                style={{ width: max > 0 ? `${(item.cost / max) * 100}%` : "0%" }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
