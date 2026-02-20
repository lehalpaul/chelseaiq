"use client";

interface ShiftRow {
  timeEntryGuid?: string;
  employeeGuid?: string;
  name: string;
  jobTitle: string;
  clockIn?: string;
  clockOut?: string;
  regularHours?: number;
  overtimeHours?: number;
  totalHours: number;
  hadOvertime: boolean;
}

interface ShiftTableProps {
  date?: string;
  shifts: ShiftRow[];
  shiftCount?: number;
  employeeCount?: number;
  totalHours?: number;
}

function formatClock(value?: string): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ShiftTable({
  date,
  shifts,
  shiftCount,
  employeeCount,
  totalHours,
}: ShiftTableProps) {
  if (!shifts || shifts.length === 0) return null;

  return (
    <div className="ai-panel overflow-hidden rounded-xl sm:rounded-2xl">
      <div className="border-b border-border/70 bg-muted/65 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium">Staffing</span>
        {date ? ` • ${date}` : ""}
        {typeof shiftCount === "number" ? ` • ${shiftCount} shifts` : ""}
        {typeof employeeCount === "number" ? ` • ${employeeCount} employees` : ""}
        {typeof totalHours === "number" ? ` • ${totalHours.toFixed(1)} hrs` : ""}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-border/70 bg-background/40">
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Employee
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Role
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                In
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Out
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Hours
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                OT
              </th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((shift, index) => (
              <tr
                key={shift.timeEntryGuid || `${shift.employeeGuid || "unknown"}-${index}`}
                className="border-b border-border/70 text-[13px] last:border-0 sm:text-sm"
              >
                <td className="px-3 py-2 font-medium">{shift.name}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {shift.jobTitle || "Unknown"}
                </td>
                <td className="px-3 py-2 text-right">{formatClock(shift.clockIn)}</td>
                <td className="px-3 py-2 text-right">{formatClock(shift.clockOut)}</td>
                <td className="px-3 py-2 text-right">
                  {typeof shift.totalHours === "number"
                    ? shift.totalHours.toFixed(2)
                    : "-"}
                </td>
                <td className="px-3 py-2 text-right">
                  {shift.hadOvertime ? (
                    <span className="rounded bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
                      +{(shift.overtimeHours || 0).toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
