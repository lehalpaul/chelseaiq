"use client";

import { formatCurrency } from "@/lib/formatters";

interface LocationData {
  locationName: string;
  netSales: number;
  orderCount: number;
  guestCount: number;
  avgCheck: number;
  laborCostPct: number;
}

interface ComparisonTableProps {
  locations: LocationData[];
}

export function ComparisonTable({ locations }: ComparisonTableProps) {
  if (!locations || locations.length === 0) return null;

  return (
    <div className="ai-panel overflow-hidden rounded-xl sm:rounded-2xl">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/65">
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Location
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Net Sales
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Orders
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Guests
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Avg Check
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Labor %
              </th>
            </tr>
          </thead>
          <tbody>
            {locations.map((loc, i) => (
              <tr
                key={loc.locationName}
                className={`border-b border-border/70 text-[13px] last:border-0 sm:text-sm ${i === 0 ? "bg-accent/10" : ""}`}
              >
                <td className="px-3 py-2 font-medium">{loc.locationName}</td>
                <td className="px-3 py-2 text-right font-semibold">
                  {formatCurrency(loc.netSales)}
                </td>
                <td className="px-3 py-2 text-right">{loc.orderCount}</td>
                <td className="px-3 py-2 text-right">{loc.guestCount}</td>
                <td className="px-3 py-2 text-right">
                  {formatCurrency(loc.avgCheck)}
                </td>
                <td className="px-3 py-2 text-right">
                  {loc.laborCostPct?.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
