"use client";

import { formatCurrency } from "@/lib/formatters";

interface Server {
  rank: number;
  name: string;
  netSales: number;
  tips: number;
  avgCheck: number;
  orderCount: number;
  salesPerHour?: number;
  hoursWorked?: number;
}

interface ServerLeaderboardProps {
  servers: Server[];
}

export function ServerLeaderboard({ servers }: ServerLeaderboardProps) {
  if (!servers || servers.length === 0) return null;

  return (
    <div className="ai-panel overflow-hidden rounded-xl sm:rounded-2xl">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/65">
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                #
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Server
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Sales
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Tips
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Avg Check
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Orders
              </th>
            </tr>
          </thead>
          <tbody>
            {servers.map((s) => (
              <tr
                key={s.rank}
                className={`border-b border-border/70 text-[13px] last:border-0 sm:text-sm ${s.rank === 1 ? "bg-accent/10" : ""}`}
              >
                <td className="px-3 py-2 font-medium">
                  {s.rank === 1 ? "🏆" : s.rank}
                </td>
                <td className="px-3 py-2 font-medium">{s.name}</td>
                <td className="px-3 py-2 text-right font-semibold">
                  {formatCurrency(s.netSales)}
                </td>
                <td className="px-3 py-2 text-right">{formatCurrency(s.tips)}</td>
                <td className="px-3 py-2 text-right">
                  {formatCurrency(s.avgCheck)}
                </td>
                <td className="px-3 py-2 text-right">{s.orderCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
