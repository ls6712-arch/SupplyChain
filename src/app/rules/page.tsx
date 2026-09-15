import { createClient } from "@/lib/supabase/server";

export default async function RulesPage() {
  const supabase = await createClient();
  const organizationId = "00000000-0000-0000-0000-000000000001";

  const { data: policyVersion } = await supabase
    .from("policy_versions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .maybeSingle();

  const { data: rules } = policyVersion
    ? await supabase.from("policy_rules").select("*").eq("policy_version_id", policyVersion.id)
    : { data: [] };

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold mb-1">Policy rules</h1>
      <p className="text-inkSoft text-sm mb-6">
        Brand-configurable constraints applied as a hard gate before any outcome is economically ranked.
        {policyVersion ? ` Active version: ${policyVersion.version_label}.` : ""}
      </p>

      <table className="w-full ledger-table text-[13px]">
        <thead>
          <tr>
            <th>Rule</th>
            <th>Applies to</th>
            <th>Effect</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {(rules ?? []).map((r: any) => (
            <tr key={r.id}>
              <td className="font-semibold">{r.name}</td>
              <td>{r.category === "any" ? "All categories" : r.category}</td>
              <td>
                {r.prohibited_outcomes?.length
                  ? `Prohibits: ${r.prohibited_outcomes.join(", ")}`
                  : r.approval_below_recovery_pct
                  ? `Requires approval below ${r.approval_below_recovery_pct}% recovery`
                  : r.requires_step_before_outcome
                  ? `Requires step before ${r.requires_step_before_outcome}`
                  : "—"}
              </td>
              <td className="text-[12px] text-inkSoft">{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {!rules?.length && (
        <div className="p-10 text-center text-inkSoft border border-dashed border-hairline rounded-sm mt-4">
          No policy version/rules seeded yet. Create a row in <code>policy_versions</code> (is_active = true) for
          your org, then add rows to <code>policy_rules</code> pointing at it.
        </div>
      )}
    </div>
  );
}
