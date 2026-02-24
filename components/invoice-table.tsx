"use client";

import { formatCurrencyPrecise } from "@/lib/formatters";

interface InvoiceRow {
  rank?: number;
  invoiceNumber: string;
  invoiceDate: string;
  vendorName: string;
  total: number;
  tax: number;
  status: string;
  isCredit?: boolean;
}

interface InvoiceTableProps {
  invoices: InvoiceRow[];
}

export function InvoiceTable({ invoices }: InvoiceTableProps) {
  if (!invoices || invoices.length === 0) {
    return (
      <div className="ai-panel rounded-xl p-3.5 text-sm text-muted-foreground sm:rounded-2xl sm:p-4">
        No invoices found.
      </div>
    );
  }

  return (
    <div className="ai-panel overflow-hidden rounded-xl sm:rounded-2xl">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border/70 bg-muted/35 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5">Vendor</th>
              <th className="px-3 py-2.5">Invoice #</th>
              <th className="px-3 py-2.5">Date</th>
              <th className="px-3 py-2.5 text-right">Total</th>
              <th className="px-3 py-2.5 text-right">Tax</th>
              <th className="px-3 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => {
              const total = invoice.isCredit
                ? -Math.abs(invoice.total)
                : invoice.total;
              return (
                <tr key={`${invoice.invoiceNumber}-${invoice.rank || 0}`} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-2.5">{invoice.vendorName || "Unknown"}</td>
                  <td className="px-3 py-2.5 font-medium">{invoice.invoiceNumber || "-"}</td>
                  <td className="px-3 py-2.5">{invoice.invoiceDate || "-"}</td>
                  <td className="px-3 py-2.5 text-right font-medium">
                    {formatCurrencyPrecise(total)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {formatCurrencyPrecise(invoice.tax || 0)}
                  </td>
                  <td className="px-3 py-2.5">{invoice.status || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
