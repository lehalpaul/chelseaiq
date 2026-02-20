"use client";

import { formatCurrency, formatCurrencyPrecise } from "@/lib/formatters";
import { MetricCard } from "./metric-card";

interface MetricsGridProps {
  data: {
    netSales?: number;
    orderCount?: number;
    guestCount?: number;
    avgCheck?: number;
    laborCostPct?: number;
    salesPerLaborHour?: number;
    tipsCollected?: number;
    comparison?: {
      salesDeltaPct?: number;
    };
  };
}

export function MetricsGrid({ data }: MetricsGridProps) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {data.netSales !== undefined && (
        <MetricCard
          label="Net Sales"
          value={formatCurrency(data.netSales)}
          delta={data.comparison?.salesDeltaPct}
          deltaLabel="vs prior"
        />
      )}
      {data.orderCount !== undefined && (
        <MetricCard label="Orders" value={String(data.orderCount)} />
      )}
      {data.guestCount !== undefined && (
        <MetricCard label="Guests" value={String(data.guestCount)} />
      )}
      {data.avgCheck !== undefined && (
        <MetricCard label="Avg Check" value={formatCurrencyPrecise(data.avgCheck)} />
      )}
      {data.laborCostPct !== undefined && (
        <MetricCard
          label="Labor Cost %"
          value={`${data.laborCostPct.toFixed(1)}%`}
        />
      )}
      {data.salesPerLaborHour !== undefined && (
        <MetricCard label="SPLH" value={formatCurrency(data.salesPerLaborHour)} />
      )}
    </div>
  );
}
