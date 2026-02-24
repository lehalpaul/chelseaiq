import { getDailyRevenue, getRevenueByLocation, getRevenueTrend, getPaymentBreakdown } from "./sales";
import {
  getTopItems,
  getBottomItems,
  getCategoryBreakdown,
  getItemPairingRate,
  getItemPerformance,
} from "./items";
import { getLaborSummary, getServerPerformance, getOvertimeReport, getEmployeesOnShift } from "./labor";
import { getDaypartBreakdown, getPeakHours } from "./daypart";
import { getGuestMetrics, getDiningOptionBreakdown } from "./guest";
import { getExecutiveBrief } from "./brief";
import { compareLocations, comparePeriods } from "./comparison";
import { addAnalysisStep } from "./analysis";
import { getDailyCost, getCostByCategory, getVendorSpend, getCostTrend, getInvoiceList } from "./costs";

export const agentTools = {
  getDailyRevenue,
  getRevenueByLocation,
  getRevenueTrend,
  getPaymentBreakdown,
  getTopItems,
  getBottomItems,
  getCategoryBreakdown,
  getItemPairingRate,
  getItemPerformance,
  getLaborSummary,
  getServerPerformance,
  getOvertimeReport,
  getEmployeesOnShift,
  getDaypartBreakdown,
  getPeakHours,
  getGuestMetrics,
  getDiningOptionBreakdown,
  getExecutiveBrief,
  compareLocations,
  comparePeriods,
  addAnalysisStep,
  getDailyCost,
  getCostByCategory,
  getVendorSpend,
  getCostTrend,
  getInvoiceList,
};
