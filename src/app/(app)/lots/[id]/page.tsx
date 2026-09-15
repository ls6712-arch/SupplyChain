import { createClient } from "@/lib/supabase/server";
import { StatusChip, fmtDollarsFromCents, fmtPct } from "../../components";
import { RunRecommendationButton, ApproveButton, ExecutionPanel } from "./client-parts";

export default async function LotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: lot } = await supabase
    .from("inventory_lots")
    .select("*, products(*), settlements(*), shipments(*)")
    .eq("id", id)
    .single();

  if (!lot) {
    return <div className="text-inkSoft">Lot not found.</div>;
  }

  const { data: recommendation } = await supabase
    .from("recommendations")
    .select("*")
    .eq("inventory_lot_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: audit } = await supabase
    .from("audit_events")
    .select("*")
    .eq("inventory_lot_id", id)
    .order("created_at", { ascending: false });

  const settlement = lot.settlements?.[0];
  const eligible: any[] = recommendation?.eligible_outcomes ?? [];
  const excluded: any[] = recommendation?.excluded_outcomes ?? [];

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <div className="text-[11px] text-inkSoft mb-1">Lots / {lot.lot_code}</div>
          <h1 className="font-serif text-2xl font-semibold font-mono">{lot.lot_code}</h1>
          <div className="text-inkSoft text-sm mt-1">
            {lot.products?.category}
            {lot.products?.is_capsule ? " · capsule/collaboration" : ""} · {lot.quantity} units ·{" "}
            {lot.source_type?.replace("_", " ")}
          </div>
        </div>
        <StatusChip status={lot.status} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-hairline border border-hairline rounded-sm overflow-hidden mb-8">
        <Stat label="Cost basis" value={fmtDollarsFromCents(lot.quantity * lot.products.cost_basis_cents)} />
        <Stat label="Retail / unit" value={fmtDollarsFromCents(lot.products.retail_value_cents)} />
        <Stat label="Like-new" value={fmtPct(lot.condition_like_new_pct)} />
        <Stat label="Repairable" value={fmtPct(lot.condition_repairable_pct)} />
        <Stat label="Non-resellable" value={fmtPct(lot.condition_non_resellable_pct)} />
      </div>

      <div className="mb-8">
        <div className="font-medium text-sm mb-3">Disposition recommendation</div>

        {!recommendation ? (
          <div className="border border-hairline rounded-sm p-5">
            <p className="text-inkSoft text-sm mb-3">
              No recommendation generated yet. Running it applies eligibility gates, brand-policy gates, and
              economic ranking to every possible outcome.
            </p>
            <RunRecommendationButton lotId={lot.id} />
          </div>
        ) : (
          <>
            {eligible.map((r, i) => (
              <div
                key={r.outcome}
                className={`border rounded-sm p-4 mb-2 flex justify-between gap-4 ${
                  i === 0 ? "border-denim bg-denimSoft" : "border-hairline"
                }`}
              >
                <div className="flex-1">
                  <div className="font-semibold text-[13.5px] mb-0.5">
                    {i === 0 ? "Recommended — " : ""}
                    {r.outcome}
                    {r.partnerName ? ` · ${r.partnerName}` : ""}
                  </div>
                  <div className="text-[12px] text-inkSoft">{r.note}</div>
                  {r.approvalNote && <div className="text-[12px] text-amber mt-1">⚠ {r.approvalNote}</div>}
                </div>
                <div className="text-right min-w-[120px]">
                  <div className={`font-mono font-semibold text-sm ${r.netRecoveryCents < 0 ? "text-clay" : ""}`}>
                    {fmtDollarsFromCents(r.netRecoveryCents)}
                  </div>
                  <div className="text-[12px] text-inkSoft">{r.unitsAffected} units</div>
                  {lot.status === "recommended" && (
                    <div className="mt-2">
                      <ApproveButton
                        lotId={lot.id}
                        recommendationId={recommendation.id}
                        outcome={r.outcome}
                        isOverride={i !== 0}
                        label={i === 0 ? "Approve" : "Approve (override)"}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}

            {excluded.length > 0 && (
              <>
                <div className="text-[13px] font-medium mt-5 mb-2">
                  Excluded outcomes <span className="text-inkSoft font-mono text-[11px]">{excluded.length}</span>
                </div>
                {excluded.map((r) => (
                  <div key={r.outcome} className="border border-hairline rounded-sm p-4 mb-2 opacity-60 flex justify-between">
                    <div>
                      <div className="font-semibold text-[13.5px]">{r.outcome}</div>
                      <div className="text-[12px] text-inkSoft">{r.excludedReason}</div>
                    </div>
                    <div className="text-[12px] text-inkSoft self-center">excluded</div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>

      {(lot.status === "approved" || lot.status === "in_execution" || lot.status === "closed") && (
        <ExecutionPanel lot={lot} settlement={settlement} recommendation={recommendation} />
      )}

      <div>
        <div className="font-medium text-sm mb-3">
          Audit trail <span className="text-inkSoft font-mono text-[11px]">{audit?.length ?? 0} events</span>
        </div>
        <div className="border border-hairline rounded-sm p-4">
          {(audit ?? []).map((a) => (
            <div key={a.id} className="flex justify-between text-[12px] text-inkSoft py-1.5 border-b border-hairline last:border-b-0">
              <span>
                <span className="text-ink">{a.action}</span> — {a.detail}
              </span>
              <span>
                {new Date(a.created_at).toLocaleString()} · {a.actor_label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper p-4">
      <div className="text-[11px] text-inkSoft mb-1.5">{label}</div>
      <div className="font-mono text-lg font-semibold">{value}</div>
    </div>
  );
}
