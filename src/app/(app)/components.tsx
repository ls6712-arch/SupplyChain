import Link from "next/link";

export function fmtDollarsFromCents(cents: number): string {
  const dollars = cents / 100;
  const sign = dollars < 0 ? "-" : "";
  return `${sign}$${Math.abs(Math.round(dollars)).toLocaleString("en-US")}`;
}

export function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

const statusStyles: Record<string, string> = {
  draft: "bg-paperDim text-inkSoft",
  submitted: "bg-denimSoft text-denim",
  recommended: "bg-denimSoft text-denim",
  approved: "bg-greenSoft text-green",
  in_execution: "bg-amberSoft text-amber",
  closed: "bg-greenSoft text-green",
  exception: "bg-claySoft text-clay",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  recommended: "Recommended",
  approved: "Approved",
  in_execution: "In execution",
  closed: "Closed",
  exception: "Exception hold",
};

export function StatusChip({ status }: { status: string }) {
  return (
    <span className={`tag-chip ${statusStyles[status] ?? "bg-paperDim text-inkSoft"}`}>
      {statusLabels[status] ?? status}
    </span>
  );
}

export function LotsTable({ lots }: { lots: any[] }) {
  if (!lots.length) {
    return (
      <div className="p-10 text-center text-inkSoft border border-dashed border-hairline rounded-sm">
        Nothing here right now.
      </div>
    );
  }
  return (
    <table className="w-full ledger-table text-[13px]">
      <thead>
        <tr>
          <th>Lot</th>
          <th>Category</th>
          <th className="text-right">Qty</th>
          <th>Status</th>
          <th className="text-right">Net recovery</th>
        </tr>
      </thead>
      <tbody>
        {lots.map((l) => (
          <tr key={l.id} className="hover:bg-paperDim">
            <td className="font-mono">
              <Link href={`/lots/${l.id}`} className="underline underline-offset-2">
                {l.lot_code}
              </Link>
            </td>
            <td>
              {l.products?.category}
              {l.products?.is_capsule ? " · capsule" : ""}
            </td>
            <td className="text-right font-mono">{l.quantity}</td>
            <td>
              <StatusChip status={l.status} />
            </td>
            <td className="text-right font-mono">
              {l.settlements?.[0]?.net_recovery_cents !== undefined
                ? fmtDollarsFromCents(l.settlements[0].net_recovery_cents)
                : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
