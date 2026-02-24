"use client";

import { formatCurrency, formatCurrencyPrecise } from "@/lib/formatters";
import { MetricCard } from "./metric-card";

interface CostMetricsGridProps {
  data: {
    totalCost?: number;
    totalTax?: number;
    totalDelivery?: number;
    totalOtherCharges?: number;
    totalCredits?: number;
    invoiceCount?: number;
    vendorCount?: number;
    comparison?: {
      dailyCostDeltaPct?: number;
    };
  };
}

export function CostMetricsGrid({ data }: CostMetricsGridProps) {
  const creditDisplay =
    data.totalCredits !== undefined && data.totalCredits !== 0
      ? `-${formatCurrencyPrecise(Math.abs(data.totalCredits))}`
      : data.totalCredits !== undefined
        ? formatCurrencyPrecise(0)
        : undefined;

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {data.totalCost !== undefined && (
        <MetricCard
          label="Total Cost"
          value={formatCurrency(data.totalCost)}
          delta={data.comparison?.dailyCostDeltaPct}
          deltaLabel="vs prior"
          invertDeltaSemantics
        />
      )}
      {data.invoiceCount !== undefined && (
        <MetricCard label="Invoices" value={String(data.invoiceCount)} />
      )}
      {data.vendorCount !== undefined && (
        <MetricCard label="Vendors" value={String(data.vendorCount)} />
      )}
      {data.totalTax !== undefined && (
        <MetricCard label="Tax" value={formatCurrencyPrecise(data.totalTax)} />
      )}
      {data.totalDelivery !== undefined && (
        <MetricCard
          label="Delivery"
          value={formatCurrencyPrecise(data.totalDelivery)}
        />
      )}
      {data.totalOtherCharges !== undefined && (
        <MetricCard
          label="Other Charges"
          value={formatCurrencyPrecise(data.totalOtherCharges)}
        />
      )}
      {creditDisplay !== undefined && (
        <MetricCard label="Credits" value={creditDisplay} />
      )}
    </div>
  );
}
