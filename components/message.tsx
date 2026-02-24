"use client";

import type { UIMessage } from "ai";
import { MetricsGrid } from "./metrics-grid";
import { ItemList } from "./item-list";
import { ServerLeaderboard } from "./server-leaderboard";
import { DaypartChart } from "./daypart-chart";
import { ComparisonTable } from "./comparison-table";
import { RecommendationCards } from "./recommendation-card";
import { ShiftTable } from "./shift-table";
import { AnalysisStep } from "./analysis-step";
import { CostMetricsGrid } from "./cost-metrics-grid";
import { CostBreakdownCard } from "./cost-breakdown-card";
import { InvoiceTable } from "./invoice-table";

type ToolRenderContext = {
  isStreaming: boolean;
};

type ToolRenderer = (
  result: Record<string, unknown>,
  context: ToolRenderContext,
) => React.ReactNode;

// Tool names that should render custom components
const TOOL_RENDERERS: Record<string, ToolRenderer> = {
  getDailyRevenue: (result) => (
    <div className="space-y-3">
      <MetricsGrid data={result} />
      {Array.isArray(result.recommendations) &&
        result.recommendations.length > 0 && (
          <RecommendationCards
            recommendations={result.recommendations as never}
          />
        )}
    </div>
  ),
  getDailyCost: (result) => (
    <div className="space-y-3">
      <CostMetricsGrid data={result as never} />
      {Array.isArray(result.recommendations) &&
        result.recommendations.length > 0 && (
          <RecommendationCards
            recommendations={result.recommendations as never}
          />
        )}
    </div>
  ),
  getCostByCategory: (result) => {
    const categories = result.categories as Array<{
      rank?: number;
      name: string;
      cost: number;
      pct?: number;
    }> | undefined;
    if (!categories) return null;
    return <CostBreakdownCard title="Cost by Category" items={categories} />;
  },
  getVendorSpend: (result) => {
    const vendors = result.vendors as Array<{
      rank?: number;
      name: string;
      cost: number;
      pct?: number;
    }> | undefined;
    if (!vendors) return null;
    return <CostBreakdownCard title="Vendor Spend" items={vendors} />;
  },
  getInvoiceList: (result) => {
    const invoices = result.invoices as Array<Record<string, unknown>> | undefined;
    if (!invoices) return null;
    return <InvoiceTable invoices={invoices as never} />;
  },
  getRevenueByLocation: (result) => {
    const locations = result.locations as Array<Record<string, unknown>>;
    if (locations) return <ComparisonTable locations={locations as never} />;
    return null;
  },
  getExecutiveBrief: (result) => {
    const totals = result.totals as Record<string, unknown> | undefined;
    const locations = result.locations as Array<Record<string, unknown>> | undefined;
    const topItems = result.topItems as Array<Record<string, unknown>> | undefined;
    const topServers = result.topServers as Array<Record<string, unknown>> | undefined;

    return (
      <div className="space-y-3">
        {totals && <MetricsGrid data={totals} />}
        {locations && locations.length > 0 && (
          <ComparisonTable locations={locations as never} />
        )}
        {topItems && topItems.length > 0 && (
          <ItemList items={topItems as never} title="Top Items" />
        )}
        {topServers && topServers.length > 0 && (
          <ServerLeaderboard servers={topServers as never} />
        )}
        {Array.isArray(result.recommendations) &&
          result.recommendations.length > 0 && (
            <RecommendationCards
              recommendations={result.recommendations as never}
            />
          )}
      </div>
    );
  },
  getTopItems: (result) => {
    const items = result.items as Array<Record<string, unknown>>;
    if (items) return <ItemList items={items as never} title="Top Items" />;
    return null;
  },
  getBottomItems: (result) => {
    const items = result.items as Array<Record<string, unknown>>;
    if (items) return <ItemList items={items as never} title="Bottom Items" />;
    return null;
  },
  getServerPerformance: (result) => {
    const servers = result.servers as Array<Record<string, unknown>>;
    if (servers) return <ServerLeaderboard servers={servers as never} />;
    return null;
  },
  getLaborSummary: (result) => (
    <div className="space-y-3">
      <MetricsGrid data={result} />
      {Array.isArray(result.recommendations) &&
        result.recommendations.length > 0 && (
          <RecommendationCards
            recommendations={result.recommendations as never}
          />
        )}
    </div>
  ),
  getDaypartBreakdown: (result) => {
    const hourly = result.hourly as Array<Record<string, unknown>>;
    if (hourly) return <DaypartChart hourly={hourly as never} />;
    return null;
  },
  getPeakHours: (result) => {
    const peak = result.peakHourBySales as Record<string, unknown> | undefined;
    const quiet = result.quietestHourBySales as Record<string, unknown> | undefined;
    if (!peak || !quiet) return null;
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="ai-panel rounded-xl p-3.5 sm:rounded-2xl sm:p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Peak Hour
          </p>
          <p className="mt-1 text-xl font-semibold">{peak.label as string}</p>
          <p className="text-sm text-muted-foreground">
            {peak.orderCount as number} orders
          </p>
        </div>
        <div className="ai-panel rounded-xl p-3.5 sm:rounded-2xl sm:p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Quietest Hour
          </p>
          <p className="mt-1 text-xl font-semibold">
            {quiet.label as string}
          </p>
          <p className="text-sm text-muted-foreground">
            {quiet.orderCount as number} orders
          </p>
        </div>
      </div>
    );
  },
  compareLocations: (result) => {
    const locations = result.locations as Array<Record<string, unknown>>;
    if (locations) return <ComparisonTable locations={locations as never} />;
    return null;
  },
  getGuestMetrics: (result) => <MetricsGrid data={result} />,
  getPaymentBreakdown: (result) => {
    const cash = result.cash as Record<string, unknown> | undefined;
    const credit = result.credit as Record<string, unknown> | undefined;
    const other = result.other as Record<string, unknown> | undefined;
    if (!cash || !credit) return null;

    const items = [
      { name: "Credit/Debit", amount: credit.amount as number, pct: credit.pct as number },
      { name: "Cash", amount: cash.amount as number, pct: cash.pct as number },
    ];
    if (other && (other.amount as number) > 0) {
      items.push({ name: "Other", amount: other.amount as number, pct: other.pct as number });
    }
    const max = Math.max(...items.map((i) => i.amount));

    return (
      <div className="ai-panel space-y-2 rounded-xl p-3.5 sm:rounded-2xl sm:p-4">
        {items.map((item) => (
          <div key={item.name} className="flex items-center gap-3">
            <span className="w-24 text-sm text-muted-foreground">{item.name}</span>
            <div className="h-4 flex-1 overflow-hidden rounded bg-muted">
              <div
                className="h-full rounded bg-accent"
                style={{ width: max > 0 ? `${(item.amount / max) * 100}%` : "0%" }}
              />
            </div>
            <span className="w-20 text-right text-sm font-medium">
              {item.pct.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    );
  },
  getEmployeesOnShift: (result) => {
    const shifts = result.shifts as Array<Record<string, unknown>>;
    if (!shifts || shifts.length === 0) return null;

    return (
      <ShiftTable
        date={result.date as string | undefined}
        shifts={shifts as never}
        shiftCount={result.shiftCount as number | undefined}
        employeeCount={result.employeeCount as number | undefined}
        totalHours={result.totalHours as number | undefined}
      />
    );
  },
  addAnalysisStep: (result, context) => {
    const title = result.title as string | undefined;
    const content = result.content as string | undefined;
    if (!title || !content) return null;

    return (
      <AnalysisStep
        title={title}
        content={content}
        isStreaming={context.isStreaming}
      />
    );
  },
};

const TOOL_LABELS: Record<string, string> = {
  getDailyRevenue: "Pulling revenue data...",
  getRevenueByLocation: "Comparing location revenue...",
  getRevenueTrend: "Loading revenue trend...",
  getPaymentBreakdown: "Loading payment mix...",
  getTopItems: "Fetching menu items...",
  getBottomItems: "Fetching underperforming items...",
  getCategoryBreakdown: "Loading category metrics...",
  getItemPairingRate: "Analyzing item pairing...",
  getItemPerformance: "Loading item performance...",
  getLaborSummary: "Loading labor metrics...",
  getServerPerformance: "Loading server data...",
  getOvertimeReport: "Loading overtime report...",
  getEmployeesOnShift: "Loading shift data...",
  getDaypartBreakdown: "Loading daypart performance...",
  getPeakHours: "Finding peak hours...",
  getGuestMetrics: "Loading guest metrics...",
  getDiningOptionBreakdown: "Loading dining option mix...",
  getExecutiveBrief: "Building executive brief...",
  compareLocations: "Comparing locations...",
  comparePeriods: "Comparing periods...",
  addAnalysisStep: "Summarizing findings...",
  getDailyCost: "Loading cost metrics...",
  getCostByCategory: "Loading category costs...",
  getVendorSpend: "Loading vendor spend...",
  getCostTrend: "Loading cost trend...",
  getInvoiceList: "Loading invoices...",
};

function extractToolName(partType: string): string | null {
  if (partType.startsWith("tool-")) {
    return partType.slice(5);
  }
  return null;
}

function getToolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? "Analyzing...";
}

function hasOutput(state: string, output: unknown): boolean {
  return (state === "output-available" || state === "result") && !!output;
}

interface MessageProps {
  message: UIMessage;
  isStreaming?: boolean;
}

export function Message({ message, isStreaming = false }: MessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`fade-in-up flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[92%] space-y-3 sm:max-w-[86%] ${
          isUser
            ? "rounded-2xl border border-accent/45 bg-accent px-4 py-2.5 text-accent-foreground shadow-md sm:rounded-3xl"
            : "rounded-2xl sm:rounded-3xl"
        }`}
      >
        {message.parts.map((part, idx) => {
          if (part.type === "text" && part.text) {
            return (
              <div
                key={idx}
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed sm:text-[15px] ${
                  isUser
                    ? ""
                    : "ai-panel text-foreground"
                }`}
              >
                {renderMarkdown(part.text, isUser)}
              </div>
            );
          }

          // Handle tool invocations - check both typed tool parts and dynamic-tool
          const toolName = extractToolName(part.type);
          if (toolName) {
            const toolPart = part as unknown as {
              state: string;
              output?: unknown;
              errorText?: string;
            };
            if (toolPart.state === "output-error") {
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger"
                >
                  {toolPart.errorText ?? "Tool execution failed."}
                </div>
              );
            }
            if (hasOutput(toolPart.state, toolPart.output)) {
              const result = toolPart.output as Record<string, unknown>;
              if (result.error) {
                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger"
                  >
                    {result.error as string}
                  </div>
                );
              }
              const renderer = TOOL_RENDERERS[toolName];
              if (renderer) {
                return (
                  <div key={idx}>
                    {renderer(result, { isStreaming })}
                  </div>
                );
              }
            }
            if (
              toolPart.state === "input-available" ||
              toolPart.state === "input-streaming"
            ) {
              return (
                <div
                  key={idx}
                  className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/75 px-3 py-1.5 text-xs font-medium text-muted-foreground sm:text-sm"
                >
                  <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                  {getToolLabel(toolName)}
                </div>
              );
            }
            return null;
          }

          if (part.type === "dynamic-tool") {
            const dynPart = part as unknown as {
              toolName: string;
              state: string;
              output?: unknown;
              errorText?: string;
            };
            if (dynPart.state === "output-error") {
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger"
                >
                  {dynPart.errorText ?? "Tool execution failed."}
                </div>
              );
            }
            if (hasOutput(dynPart.state, dynPart.output)) {
              const result = dynPart.output as Record<string, unknown>;
              if (result.error) {
                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger"
                  >
                    {result.error as string}
                  </div>
                );
              }
              const renderer = TOOL_RENDERERS[dynPart.toolName];
              if (renderer) {
                return (
                  <div key={idx}>
                    {renderer(result, { isStreaming })}
                  </div>
                );
              }
            }
            if (
              dynPart.state === "input-available" ||
              dynPart.state === "input-streaming"
            ) {
              return (
                <div
                  key={idx}
                  className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/75 px-3 py-1.5 text-xs font-medium text-muted-foreground sm:text-sm"
                >
                  <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                  {getToolLabel(dynPart.toolName)}
                </div>
              );
            }
          }

          return null;
        })}
      </div>
    </div>
  );
}

function renderMarkdown(text: string, isUser: boolean): React.ReactNode {
  const lines = text.split("\n");
  return lines.map((line, lineIndex) => (
    <span key={`line-${lineIndex}`}>
      {renderInlineMarkdown(line, isUser, lineIndex)}
      {lineIndex < lines.length - 1 ? <br /> : null}
    </span>
  ));
}

function renderInlineMarkdown(
  line: string,
  isUser: boolean,
  lineIndex: number,
): React.ReactNode[] {
  const codeClass = isUser
    ? "rounded bg-accent-foreground/20 px-1.5 py-0.5 font-mono text-xs"
    : "rounded bg-muted px-1.5 py-0.5 font-mono text-xs";

  return line
    .split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g)
    .filter((segment) => segment.length > 0)
    .map((segment, segmentIndex) => {
      const key = `${lineIndex}-${segmentIndex}`;
      if (
        segment.startsWith("**") &&
        segment.endsWith("**") &&
        segment.length > 4
      ) {
        return <strong key={key}>{segment.slice(2, -2)}</strong>;
      }
      if (
        segment.startsWith("*") &&
        segment.endsWith("*") &&
        !segment.startsWith("**") &&
        segment.length > 2
      ) {
        return <em key={key}>{segment.slice(1, -1)}</em>;
      }
      if (
        segment.startsWith("`") &&
        segment.endsWith("`") &&
        segment.length > 2
      ) {
        return (
          <code key={key} className={codeClass}>
            {segment.slice(1, -1)}
          </code>
        );
      }
      return <span key={key}>{segment}</span>;
    });
}
