import { createClient } from "@/lib/supabase/server";
import { fmtDollarsFromCents, fmtPct } from "../components";

export default async function ReportsPage() {
  const supabase = await createClient();
  const organizationId = "00000000-0000-0000-0000-000000000001";

  const { data: lots } = await supabase
    .from("inventory_lots")
    .select("*, settlements(*)")
    .eq("organization_id", organizationId);

  const { data: recommendations } = await supabase
    .from("recommendations")
    .select("id, baseline_net_recovery_cents, inventory_lot_id");

  const { data: approvals } = await supabase.from("approvals").select("is_override");

  const allLots = lots ?? [];
  const closed = allLots.filter((l) => l.status === "closed");
  const totalRecovery = closed.reduce((s, l) => s + (l.settlements?.[0]?.net_recovery_cents ?? 0), 0);

  const baselineByLot = new Map((recommendations ?? []).map((r) => [r.inventory_lot_id, r.baseline_net_recovery_cents ?? 0]));
  const totalBaseline = closed.reduce((s, l) => s + (baselineByLot.get(l.id) ?? 0), 0);

  const overrideCount = (approvals ?? []).filter((a) => a.is_override).length;
  const totalDecided = (approvals ?? []).length;

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold mb-1">Reports</h1>
      <p className="text-inkSoft text-sm mb-6">Realized outcomes, not projected AI value.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-hairline border border-hairline rounded-sm overflow-hidden">
        <Stat label="Total net recovery, closed lots" value={fmtDollarsFromCents(totalRecovery)} />
        <Stat label="vs. baseline route" value={fmtDollarsFromCents(totalRecovery - totalBaseline)} />
        <Stat
          label="Override rate"
          value={totalDecided ? fmtPct(overrideCount / totalDecided) : "—"}
          sub={`${overrideCount} of ${totalDecided} decisions`}
        />
        <Stat label="Lots closed" value={String(closed.length)} sub={`of ${allLots.length} total`} />
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-paper p-4">
      <div className="text-[11px] text-inkSoft mb-1.5">{label}</div>
      <div className="font-mono text-xl font-semibold">{value}</div>
      {sub && <div className="text-[11px] text-inkSoft mt-1">{sub}</div>}
    </div>
  );
}
