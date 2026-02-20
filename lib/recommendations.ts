export interface Recommendation {
  id: string;
  category: "revenue" | "labor" | "menu" | "operations";
  severity: "info" | "warning" | "critical";
  title: string;
  body: string;
  metric: string;
  value: number;
  threshold: number;
}

interface MetricData {
  netSales?: number;
  laborCostPct?: number;
  avgCheck?: number;
  overtimeHours?: number;
  salesPerLaborHour?: number;
  totalDiscounts?: number;
  grossSales?: number;
  comparison?: {
    netSales?: number;
    avgCheck?: number;
    salesDeltaPct?: number;
  };
}

const rules: Array<{
  id: string;
  evaluate: (data: MetricData) => Recommendation | null;
}> = [
  {
    id: "high-labor-cost",
    evaluate: (data) => {
      const pct = data.laborCostPct;
      if (pct === undefined || pct === 0) return null;
      if (pct > 40) {
        return {
          id: "high-labor-cost",
          category: "labor",
          severity: "critical",
          title: "Labor cost is critically high",
          body: `Labor is running at ${pct.toFixed(1)}% of net sales, well above the 35% target. Review scheduling and consider cutting hours during slow dayparts.`,
          metric: "laborCostPct",
          value: pct,
          threshold: 40,
        };
      }
      if (pct > 35) {
        return {
          id: "high-labor-cost",
          category: "labor",
          severity: "warning",
          title: "Labor cost is above target",
          body: `Labor is at ${pct.toFixed(1)}% of net sales, above the 35% target. Monitor closely and adjust staffing if the trend continues.`,
          metric: "laborCostPct",
          value: pct,
          threshold: 35,
        };
      }
      return null;
    },
  },
  {
    id: "low-avg-check",
    evaluate: (data) => {
      if (!data.avgCheck || !data.comparison?.avgCheck) return null;
      const delta =
        ((data.avgCheck - data.comparison.avgCheck) /
          data.comparison.avgCheck) *
        100;
      if (delta < -10) {
        return {
          id: "low-avg-check",
          category: "revenue",
          severity: "warning",
          title: "Average check is declining",
          body: `Average check dropped ${Math.abs(delta).toFixed(1)}% compared to the prior period ($${data.avgCheck.toFixed(2)} vs $${data.comparison.avgCheck.toFixed(2)}). Consider upselling strategies or menu adjustments.`,
          metric: "avgCheck",
          value: delta,
          threshold: -10,
        };
      }
      return null;
    },
  },
  {
    id: "overtime-detected",
    evaluate: (data) => {
      const ot = data.overtimeHours;
      if (ot === undefined || ot === 0) return null;
      if (ot > 8) {
        return {
          id: "overtime-detected",
          category: "labor",
          severity: "critical",
          title: "Significant overtime detected",
          body: `${ot.toFixed(1)} overtime hours were logged. At 1.5x pay, this significantly impacts labor cost. Review schedules to prevent recurring overtime.`,
          metric: "overtimeHours",
          value: ot,
          threshold: 8,
        };
      }
      if (ot > 0) {
        return {
          id: "overtime-detected",
          category: "labor",
          severity: "warning",
          title: "Overtime hours logged",
          body: `${ot.toFixed(1)} overtime hours were recorded. Monitor to ensure this doesn't become a pattern.`,
          metric: "overtimeHours",
          value: ot,
          threshold: 0,
        };
      }
      return null;
    },
  },
  {
    id: "revenue-decline",
    evaluate: (data) => {
      if (!data.comparison?.salesDeltaPct) return null;
      const delta = data.comparison.salesDeltaPct;
      if (delta < -15) {
        return {
          id: "revenue-decline",
          category: "revenue",
          severity: "critical",
          title: "Significant revenue decline",
          body: `Revenue dropped ${Math.abs(delta).toFixed(1)}% compared to the prior period. Investigate whether this is due to traffic, check size, or external factors.`,
          metric: "salesDeltaPct",
          value: delta,
          threshold: -15,
        };
      }
      return null;
    },
  },
  {
    id: "low-splh",
    evaluate: (data) => {
      const splh = data.salesPerLaborHour;
      if (splh === undefined || splh === 0) return null;
      if (splh < 40) {
        return {
          id: "low-splh",
          category: "labor",
          severity: "warning",
          title: "Low sales per labor hour",
          body: `SPLH is $${splh.toFixed(2)}, below the $40 target. Either sales need to increase or labor hours should be reduced during slow periods.`,
          metric: "salesPerLaborHour",
          value: splh,
          threshold: 40,
        };
      }
      return null;
    },
  },
  {
    id: "high-discounts",
    evaluate: (data) => {
      const discounts = data.totalDiscounts;
      const gross = data.grossSales;
      if (!discounts || !gross || gross === 0) return null;
      const pct = (discounts / gross) * 100;
      if (pct > 5) {
        return {
          id: "high-discounts",
          category: "operations",
          severity: "warning",
          title: "High discount rate",
          body: `Discounts represent ${pct.toFixed(1)}% of gross sales ($${discounts.toFixed(2)}). Review discount policies and track which discounts are being used most.`,
          metric: "discountPct",
          value: pct,
          threshold: 5,
        };
      }
      return null;
    },
  },
];

export function evaluateRecommendations(
  data: MetricData
): Recommendation[] {
  const results: Recommendation[] = [];
  for (const rule of rules) {
    const rec = rule.evaluate(data);
    if (rec) results.push(rec);
  }
  // Sort by severity: critical first, then warning, then info
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  results.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );
  return results;
}
