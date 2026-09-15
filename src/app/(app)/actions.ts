"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runDispositionEngine, type Outcome, type PartnerInput, type PolicyRuleInput } from "@/lib/rules-engine";

// NOTE: every function here assumes the caller already belongs to the
// relevant organization -- RLS enforces that at the database layer even
// if a bug in this code forgot to check it, so these actions stay thin.

export async function createLot(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const organizationId = formData.get("organizationId") as string;
  const facilityId = formData.get("facilityId") as string;
  const category = formData.get("category") as string;
  const quantity = parseInt(formData.get("quantity") as string, 10);
  const costBasisUnitCents = Math.round(parseFloat(formData.get("costBasis") as string) * 100);
  const retailValueCents = Math.round(parseFloat(formData.get("retailValue") as string) * 100);
  const likeNewPct = parseFloat(formData.get("likeNewPct") as string) / 100;
  const repairablePct = parseFloat(formData.get("repairablePct") as string) / 100;
  const nonResellablePct = parseFloat(formData.get("nonResellablePct") as string) / 100;
  const isCapsule = formData.get("isCapsule") === "on";
  const sourceType = formData.get("sourceType") as string;

  // Product row (in a fuller build, look up an existing SKU instead of
  // always creating one -- kept simple here for the pilot).
  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      organization_id: organizationId,
      sku: `SKU-${Date.now()}`,
      category,
      is_capsule: isCapsule,
      cost_basis_cents: costBasisUnitCents,
      retail_value_cents: retailValueCents,
    })
    .select()
    .single();
  if (productError) throw productError;

  const { data: lotCountRes } = await supabase
    .from("inventory_lots")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);
  const nextNum = 1001 + (lotCountRes ? 0 : 0); // placeholder; replace with a real sequence/count in production
  const lotCode = `LOT-${Date.now().toString().slice(-6)}`;

  const { data: lot, error: lotError } = await supabase
    .from("inventory_lots")
    .insert({
      organization_id: organizationId,
      facility_id: facilityId,
      product_id: product.id,
      lot_code: lotCode,
      status: "draft",
      source_type: sourceType,
      quantity,
      condition_like_new_pct: likeNewPct,
      condition_repairable_pct: repairablePct,
      condition_non_resellable_pct: nonResellablePct,
      created_by: user.id,
    })
    .select()
    .single();
  if (lotError) throw lotError;

  await supabase.from("audit_events").insert({
    organization_id: organizationId,
    inventory_lot_id: lot.id,
    actor_user_id: user.id,
    actor_label: user.email ?? "Operator",
    action: "Lot intake",
    detail: `${quantity} units, ${category}.`,
  });

  revalidatePath("/lots");
  return lot.id as string;
}

export async function runRecommendation(lotId: string) {
  const supabase = await createClient();

  const { data: lot, error: lotError } = await supabase
    .from("inventory_lots")
    .select("*, products(*)")
    .eq("id", lotId)
    .single();
  if (lotError || !lot) throw lotError ?? new Error("Lot not found");

  const [{ data: partnersRaw }, { data: policyVersion }] = await Promise.all([
    supabase.from("partners").select("*, partner_capabilities(*)").eq("organization_id", lot.organization_id).eq("is_active", true),
    supabase.from("policy_versions").select("*").eq("organization_id", lot.organization_id).eq("is_active", true).single(),
  ]);

  const { data: rulesRaw } = await supabase
    .from("policy_rules")
    .select("*")
    .eq("policy_version_id", policyVersion?.id);

  const partners: PartnerInput[] = (partnersRaw ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    categories: (p.partner_capabilities ?? []).map((c: any) => c.category),
    minVolumeUnits: p.min_volume_units,
    payoutPct: Number(p.payout_pct),
    feePct: Number(p.fee_pct),
    costPerUnitCents: p.cost_per_unit_cents ?? undefined,
    leadTimeDays: p.lead_time_days,
  }));

  const policyRules: PolicyRuleInput[] = (rulesRaw ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    prohibitedOutcomes: r.prohibited_outcomes ?? [],
    requiresStepBeforeOutcome: r.requires_step_before_outcome ?? undefined,
    approvalBelowRecoveryPct: r.approval_below_recovery_pct ?? undefined,
    note: r.note ?? undefined,
  }));

  const result = runDispositionEngine(
    {
      category: lot.products.category,
      quantity: lot.quantity,
      costBasisUnitCents: lot.products.cost_basis_cents,
      retailValueUnitCents: lot.products.retail_value_cents,
      conditionMix: {
        likeNew: Number(lot.condition_like_new_pct),
        repairable: Number(lot.condition_repairable_pct),
        nonResellable: Number(lot.condition_non_resellable_pct),
      },
      isCapsule: lot.products.is_capsule,
    },
    partners,
    policyRules
  );

  const { data: recommendation, error: recError } = await supabase
    .from("recommendations")
    .insert({
      inventory_lot_id: lotId,
      policy_version_id: policyVersion?.id,
      status: "submitted",
      recommended_outcome: result.recommended?.outcome ?? null,
      eligible_outcomes: result.eligible,
      excluded_outcomes: result.excluded,
      projected_net_recovery_cents: result.recommended?.netRecoveryCents ?? null,
      baseline_net_recovery_cents: result.baselineNetRecoveryCents,
      confidence: result.eligible.length ? "medium" : "low",
    })
    .select()
    .single();
  if (recError) throw recError;

  const newStatus = result.eligible.length ? "recommended" : "exception";
  await supabase.from("inventory_lots").update({ status: newStatus }).eq("id", lotId);

  await supabase.from("audit_events").insert({
    organization_id: lot.organization_id,
    inventory_lot_id: lotId,
    actor_label: "System",
    action: "Recommendation generated",
    detail: result.eligible.length
      ? `Top pick: ${result.eligible[0].outcome} at ${(result.eligible[0].netRecoveryCents / 100).toFixed(0)}.`
      : "No eligible outcome survived the gates — routed to exception hold.",
  });

  revalidatePath(`/lots/${lotId}`);
  return recommendation.id as string;
}

export async function approveRecommendation(
  lotId: string,
  recommendationId: string,
  chosenOutcome: Outcome,
  isOverride: boolean,
  overrideReason: string | null
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  if (isOverride && !overrideReason) throw new Error("An override requires a reason.");

  const { data: lot } = await supabase.from("inventory_lots").select("organization_id").eq("id", lotId).single();

  await supabase.from("approvals").insert({
    recommendation_id: recommendationId,
    approver_user_id: user.id,
    decision: "approved",
    chosen_outcome: chosenOutcome,
    is_override: isOverride,
    override_reason: overrideReason,
  });

  await supabase
    .from("inventory_lots")
    .update({ status: "approved", chosen_outcome: chosenOutcome, override_reason: overrideReason })
    .eq("id", lotId);

  await supabase.from("audit_events").insert({
    organization_id: lot?.organization_id,
    inventory_lot_id: lotId,
    actor_user_id: user.id,
    actor_label: user.email ?? "Approver",
    action: isOverride ? "Approved (override)" : "Approved",
    detail: `Chosen outcome: ${chosenOutcome}.${overrideReason ? " Reason: " + overrideReason : ""}`,
  });

  revalidatePath(`/lots/${lotId}`);
}

export async function markExecuting(lotId: string, partnerId: string | null, originFacilityId: string) {
  const supabase = await createClient();
  const { data: lot } = await supabase.from("inventory_lots").select("organization_id").eq("id", lotId).single();

  await supabase.from("shipments").insert({
    inventory_lot_id: lotId,
    partner_id: partnerId,
    origin_facility_id: originFacilityId,
    status: "pending",
  });
  await supabase.from("inventory_lots").update({ status: "in_execution" }).eq("id", lotId);

  await supabase.from("audit_events").insert({
    organization_id: lot?.organization_id,
    inventory_lot_id: lotId,
    actor_label: "Operator",
    action: "Handoff initiated",
    detail: "Pickup/shipment coordinated.",
  });

  revalidatePath(`/lots/${lotId}`);
}

export async function reconcileLot(lotId: string, grossProceedsCents: number, feesCents: number, logisticsCostsCents: number) {
  const supabase = await createClient();
  const { data: lot } = await supabase.from("inventory_lots").select("organization_id").eq("id", lotId).single();

  const netRecoveryCents = grossProceedsCents - feesCents - logisticsCostsCents;

  await supabase.from("settlements").insert({
    inventory_lot_id: lotId,
    gross_proceeds_cents: grossProceedsCents,
    fees_cents: feesCents,
    logistics_costs_cents: logisticsCostsCents,
    net_recovery_cents: netRecoveryCents,
    payment_status: "received",
  });

  await supabase.from("inventory_lots").update({ status: "closed" }).eq("id", lotId);

  await supabase.from("audit_events").insert({
    organization_id: lot?.organization_id,
    inventory_lot_id: lotId,
    actor_label: "Operator",
    action: "Reconciled",
    detail: `Settlement recorded: ${(netRecoveryCents / 100).toFixed(0)} net recovery. Lot closed.`,
  });

  revalidatePath(`/lots/${lotId}`);
}
