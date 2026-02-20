interface MetricCardProps {
  label: string;
  value: string;
  delta?: number | null;
  deltaLabel?: string;
  format?: "currency" | "percent" | "number";
}

export function MetricCard({
  label,
  value,
  delta,
  deltaLabel,
}: MetricCardProps) {
  const isPositive = delta !== undefined && delta !== null && delta > 0;
  const isNegative = delta !== undefined && delta !== null && delta < 0;

  return (
    <div className="ai-panel rounded-xl p-3.5 sm:rounded-2xl sm:p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
        {value}
      </p>
      {delta !== undefined && delta !== null && (
        <p
          className={`mt-1 text-xs font-medium sm:text-sm ${
            isPositive
              ? "text-success"
              : isNegative
                ? "text-danger"
                : "text-muted-foreground"
          }`}
        >
          {isPositive ? "▲" : isNegative ? "▼" : "—"}{" "}
          {Math.abs(delta).toFixed(1)}%{deltaLabel ? ` ${deltaLabel}` : ""}
        </p>
      )}
    </div>
  );
}
