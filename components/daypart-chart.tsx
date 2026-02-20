"use client";

import { formatCurrency } from "@/lib/formatters";

interface HourData {
  hour: number;
  label: string;
  orderCount: number;
  netSales: number;
}

interface DaypartChartProps {
  hourly: HourData[];
}

export function DaypartChart({ hourly }: DaypartChartProps) {
  if (!hourly || hourly.length === 0) return null;

  const maxSales = Math.max(...hourly.map((h) => h.netSales));

  return (
    <div className="ai-panel rounded-xl p-3.5 sm:rounded-2xl sm:p-4">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Sales by Hour
      </h3>
      <div className="space-y-2">
        {hourly.map((h) => (
          <div key={h.hour} className="flex items-center gap-2">
            <span className="w-12 text-[11px] text-muted-foreground sm:text-xs">
              {h.label}
            </span>
            <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
              <div
                className="h-full rounded bg-accent transition-all duration-300"
                style={{
                  width: maxSales > 0 ? `${(h.netSales / maxSales) * 100}%` : "0%",
                }}
              />
            </div>
            <span className="w-16 text-right font-mono text-[11px] font-medium sm:text-xs">
              {formatCurrency(h.netSales)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
