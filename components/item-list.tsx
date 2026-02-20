"use client";

import { formatCurrency } from "@/lib/formatters";

interface Item {
  rank: number;
  name: string;
  category?: string;
  quantitySold?: number;
  revenue: number;
  avgPrice?: number;
}

interface ItemListProps {
  items: Item[];
  title?: string;
}

export function ItemList({ items, title }: ItemListProps) {
  if (!items || items.length === 0) return null;
  const maxRevenue = Math.max(...items.map((i) => i.revenue), 1);

  return (
    <div className="ai-panel rounded-xl p-3.5 sm:rounded-2xl sm:p-4">
      {title && (
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </h3>
      )}
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.rank} className="flex items-center gap-3">
            <span className="w-6 text-right text-sm font-medium text-muted-foreground">
              {item.rank}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">
                  {item.name}
                </span>
                <span className="whitespace-nowrap text-sm font-semibold">
                  {formatCurrency(item.revenue)}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{
                    width: `${(item.revenue / maxRevenue) * 100}%`,
                  }}
                />
              </div>
              <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {item.category && <span>{item.category}</span>}
                {item.quantitySold !== undefined && (
                  <span>{item.quantitySold} sold</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
