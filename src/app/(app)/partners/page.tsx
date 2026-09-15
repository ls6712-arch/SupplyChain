import { createClient } from "@/lib/supabase/server";
import { fmtPct } from "../components";

export default async function PartnersPage() {
  const supabase = await createClient();
  const organizationId = "00000000-0000-0000-0000-000000000001";

  const { data: partners } = await supabase
    .from("partners")
    .select("*, partner_capabilities(*)")
    .eq("organization_id", organizationId);

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold mb-1">Partner directory</h1>
      <p className="text-inkSoft text-sm mb-6">
        Curated downstream partners the rules engine matches lots against — capability data, not a contact list.
      </p>

      <table className="w-full ledger-table text-[13px]">
        <thead>
          <tr>
            <th>Partner</th>
            <th>Type</th>
            <th>Categories</th>
            <th className="text-right">Min. volume</th>
            <th className="text-right">Payout</th>
            <th className="text-right">Fee</th>
            <th className="text-right">Lead time</th>
          </tr>
        </thead>
        <tbody>
          {(partners ?? []).map((p: any) => (
            <tr key={p.id}>
              <td>
                <div className="font-semibold">{p.name}</div>
                <div className="text-[12px] text-inkSoft">{p.notes}</div>
              </td>
              <td>{p.type}</td>
              <td>{(p.partner_capabilities ?? []).map((c: any) => c.category).join(", ")}</td>
              <td className="text-right font-mono">{p.min_volume_units}</td>
              <td className="text-right font-mono">{fmtPct(Number(p.payout_pct))}</td>
              <td className="text-right font-mono">{fmtPct(Number(p.fee_pct))}</td>
              <td className="text-right font-mono">{p.lead_time_days}d</td>
            </tr>
          ))}
        </tbody>
      </table>

      {!partners?.length && (
        <div className="p-10 text-center text-inkSoft border border-dashed border-hairline rounded-sm mt-4">
          No partners yet. Insert rows into <code>partners</code> and <code>partner_capabilities</code> to get
          started — or add a simple form here once you've validated the fields with real vendors.
        </div>
      )}
    </div>
  );
}
