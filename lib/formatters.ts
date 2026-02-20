const USD_COMPACT_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const USD_PRECISE_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatCurrency(value: number): string {
  return USD_COMPACT_FORMATTER.format(value);
}

export function formatCurrencyPrecise(value: number): string {
  return USD_PRECISE_FORMATTER.format(value);
}
