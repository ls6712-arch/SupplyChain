import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusChip, fmtDollarsFromCents, LotsTable } from "./components";

export default async function DashboardPage() {
  const supabase = await createClient();

  // In a real multi-org app, resolve the active org from the signed-in
  // user's session/membership. Hardcoded here to the seeded demo org.
  const organizationId = "00000000-0000-0000-0000-000000000001";

  const { data: lots } = await supabase
    .from("inventory_lots")
    .select("*, products(*), settlements(*)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  const allLots = lots ?? [];
  const closed = allLots.filter((l) => l.status === "closed");
  const draft = allLots.filter((l) => l.status === "draft");
  const pending = allLots.filter((l) => l.status === "recommended");
  const exception = allLots.filter((l) => l.status === "exception");

  const totalRecovery = closed.reduce(
    (sum, l) => sum + (l.settlements?.[0]?.net_recovery_cents ?? 0),
    0
  );

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold">Dashboard</h1>
          <div className="text-inkSoft text-sm mt-1">
            {allLots.length} lots tracked across your facilities
          </div>
        </div>
        <Link href="/lots/new" className="bg-denim text-white text-[12.5px] font-medium py-2 px-3.5 rounded-sm">
          + New lot
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-hairline border border-hairline rounded-sm overflow-hidden mb-8">
        <Stat label="Net recovery — closed lots" value={fmtDollarsFromCents(totalRecovery)} />
        <Stat label="Awaiting intake review" value={String(draft.length)} sub="Need a recommendation run" />
        <Stat label="Pending approval" value={String(pending.length)} sub="Ready for sign-off" />
        <Stat label="Exception holds" value={String(exception.length)} sub="No compliant automatic path" />
      </div>

      <Section title="Needs attention" count={draft.length + pending.length}>
        <LotsTable lots={[...draft, ...pending]} />
      </Section>

      <Section title="Recently closed" count={closed.length}>
        <LotsTable lots={closed} />
      </Section>
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

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="flex items-baseline gap-2 mb-3">
        <div className="font-medium text-sm">{title}</div>
        <div className="text-inkSoft text-[11px] font-mono">{count}</div>
      </div>
      {children}
    </div>
  );
}
