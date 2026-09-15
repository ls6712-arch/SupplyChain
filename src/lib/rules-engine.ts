/**
 * Disposition Policy Engine
 * ---------------------------------------------------------------
 * Pure, deterministic, no I/O. Given a lot, its product, the org's
 * active policy rules, and its partner directory, returns a ranked
 * set of eligible outcomes and a list of excluded outcomes with the
 * stated reason for each exclusion.
 *
 * Gate order (never skip or reorder without updating the plan):
 *   1. Hard eligibility  -- physical/partner-capacity constraints
 *   2. Brand policy       -- customer-configured channel/brand rules
 *   3. Economic ranking   -- only for outcomes that survive 1 & 2
 *
 * This function is intentionally framework-free so it can be called
 * from a Next.js server action, a background job, or a unit test
 * with the same inputs and the same result.
 */

export type Outcome =
  | "restock"
  | "repair_resale"
  | "resale_partner"
  | "outlet"
  | "liquidation"
  | "donation"
  | "recycling";

export interface LotInput {
  category: string;
  quantity: number;
  costBasisUnitCents: number;
  retailValueUnitCents: number;
  conditionMix: { likeNew: number; repairable: number; nonResellable: number }; // fractions summing to ~1
  isCapsule: boolean;
}

export interface PartnerInput {
  id: string;
  name: string;
  type: "resale" | "repair" | "liquidator" | "donation" | "recycler";
  categories: string[];
  minVolumeUnits: number;
  payoutPct: number; // 0-1
  feePct: number; // 0-1
  costPerUnitCents?: number;
  leadTimeDays: number;
}

export interface PolicyRuleInput {
  id: string;
  name: string;
  category: string; // "any" or specific
  prohibitedOutcomes: Outcome[];
  requiresStepBeforeOutcome?: Outcome;
  approvalBelowRecoveryPct?: number;
  note?: string;
}

export interface OutcomeResult {
  outcome: Outcome;
  excludedReason: string | null;
  note: string;
  netRecoveryCents: number;
  partnerId: string | null;
  partnerName: string | null;
  approvalNote: string | null;
  unitsAffected: number;
}

export interface RecommendationResult {
  likeNewUnits: number;
  repairableUnits: number;
  nonResellableUnits: number;
  costBasisCents: number;
  eligible: OutcomeResult[]; // sorted best-first by netRecoveryCents
  excluded: OutcomeResult[];
  recommended: OutcomeResult | null;
  baselineNetRecoveryCents: number;
}

const HANDLING_PER_UNIT_CENTS = 160;
const SHIPPING_PER_UNIT_CENTS = 310;
const DEFAULT_REPAIR_COST_CENTS = 700;

export function runDispositionEngine(
  lot: LotInput,
  partners: PartnerInput[],
  policyRules: PolicyRuleInput[]
): RecommendationResult {
  const qty = lot.quantity;
  const likeNewUnits = Math.round(qty * lot.conditionMix.likeNew);
  const repairableUnits = Math.round(qty * lot.conditionMix.repairable);
  const nonResellableUnits = qty - likeNewUnits - repairableUnits;
  const costBasisCents = qty * lot.costBasisUnitCents;

  const outcomes: Outcome[] = [
    "restock",
    "repair_resale",
    "resale_partner",
    "outlet",
    "liquidation",
    "donation",
    "recycling",
  ];

  const results: OutcomeResult[] = outcomes.map((outcome) =>
    evaluateOutcome(outcome, lot, partners, policyRules, {
      qty,
      likeNewUnits,
      repairableUnits,
      nonResellableUnits,
      costBasisCents,
    })
  );

  const eligible = results
    .filter((r) => !r.excludedReason)
    .sort((a, b) => b.netRecoveryCents - a.netRecoveryCents);
  const excluded = results.filter((r) => r.excludedReason);
  const recommended = eligible[0] ?? null;

  const liquidationRaw = results.find((r) => r.outcome === "liquidation");
  const baselineNetRecoveryCents =
    liquidationRaw && !liquidationRaw.excludedReason
      ? liquidationRaw.netRecoveryCents
      : eligible.length
      ? eligible[eligible.length - 1].netRecoveryCents
      : 0;

  return {
    likeNewUnits,
    repairableUnits,
    nonResellableUnits,
    costBasisCents,
    eligible,
    excluded,
    recommended,
    baselineNetRecoveryCents,
  };
}

function evaluateOutcome(
  outcome: Outcome,
  lot: LotInput,
  partners: PartnerInput[],
  policyRules: PolicyRuleInput[],
  units: {
    qty: number;
    likeNewUnits: number;
    repairableUnits: number;
    nonResellableUnits: number;
    costBasisCents: number;
  }
): OutcomeResult {
  const { qty, likeNewUnits, repairableUnits, nonResellableUnits, costBasisCents } = units;
  let excludedReason: string | null = null;
  let note = "";
  let approvalNote: string | null = null;
  let partner: PartnerInput | null = null;

  // ---------------- Gate 1: hard eligibility ----------------
  if (outcome === "restock" && likeNewUnits === 0) {
    excludedReason = "No like-new units available to restock.";
  }
  if (outcome === "repair_resale" && repairableUnits === 0) {
    excludedReason = "No repairable units in this lot.";
  }
  if (outcome === "recycling" && nonResellableUnits === 0) {
    excludedReason = "No non-resellable units to route to recycling.";
  }

  const partnerTypeMap: Partial<Record<Outcome, PartnerInput["type"]>> = {
    resale_partner: "resale",
    liquidation: "liquidator",
    donation: "donation",
    recycling: "recycler",
  };

  if (!excludedReason && partnerTypeMap[outcome]) {
    const type = partnerTypeMap[outcome]!;
    const eligibleUnits =
      outcome === "recycling" ? nonResellableUnits : outcome === "resale_partner" ? likeNewUnits : qty;
    const candidates = partners.filter((p) => p.type === type);
    partner =
      candidates.find((p) => p.categories.includes(lot.category) && eligibleUnits >= p.minVolumeUnits) ?? null;

    if (!partner) {
      const anyOfType = candidates[0];
      if (!anyOfType) {
        excludedReason = "No partner of this type in the directory.";
      } else if (!anyOfType.categories.includes(lot.category)) {
        excludedReason = `${anyOfType.name} does not accept category "${lot.category}".`;
      } else {
        excludedReason = `Eligible unit count below ${anyOfType.name}'s minimum volume (${anyOfType.minVolumeUnits}).`;
      }
    }
  }

  // ---------------- Gate 2: brand policy ----------------
  if (!excludedReason) {
    for (const rule of policyRules) {
      const categoryMatches = rule.category === "any" || rule.category === lot.category;
      if (!categoryMatches) continue;

      if (rule.prohibitedOutcomes.includes(outcome)) {
        excludedReason = `Excluded by brand policy: "${rule.name}".`;
      }
      if (rule.requiresStepBeforeOutcome === outcome && rule.note) {
        note = note ? `${note} ${rule.note}` : rule.note;
      }
    }
    if (!excludedReason && lot.isCapsule && outcome === "liquidation") {
      excludedReason = "Excluded: capsule/collaboration SKU — no uncontrolled liquidation permitted.";
    }
  }

  // ---------------- Gate 3: economic ranking ----------------
  let netRecoveryCents = 0;
  if (!excludedReason) {
    switch (outcome) {
      case "restock": {
        const proceeds = likeNewUnits * lot.retailValueUnitCents * 0.92;
        const cost = likeNewUnits * HANDLING_PER_UNIT_CENTS;
        netRecoveryCents = proceeds - cost;
        note = note || `${likeNewUnits} like-new units returned to sellable stock at ~92% of retail.`;
        break;
      }
      case "repair_resale": {
        const repairPartner = partners.find((p) => p.type === "repair" && p.categories.includes(lot.category));
        const repairCost = repairPartner?.costPerUnitCents ?? DEFAULT_REPAIR_COST_CENTS;
        const proceeds = repairableUnits * lot.retailValueUnitCents * 0.6;
        const cost = repairableUnits * (repairCost + SHIPPING_PER_UNIT_CENTS);
        netRecoveryCents = proceeds - cost;
        partner = repairPartner ?? null;
        note = note || `${repairableUnits} units repaired then sold at ~60% of retail via ${repairPartner?.name ?? "a repair partner"}.`;
        break;
      }
      case "resale_partner": {
        const gross = likeNewUnits * lot.retailValueUnitCents * (partner?.payoutPct ?? 0);
        const fee = gross * (partner?.feePct ?? 0);
        const cost = likeNewUnits * SHIPPING_PER_UNIT_CENTS;
        netRecoveryCents = gross - fee - cost;
        note =
          note ||
          `${likeNewUnits} like-new units via ${partner?.name} at ${pct(partner?.payoutPct)} payout, ${pct(
            partner?.feePct
          )} platform fee.`;
        break;
      }
      case "outlet": {
        const proceeds = qty * lot.retailValueUnitCents * 0.35;
        const cost = qty * HANDLING_PER_UNIT_CENTS;
        netRecoveryCents = proceeds - cost;
        note = note || `Full lot routed to controlled outlet channel at ~35% of retail.`;
        break;
      }
      case "liquidation": {
        const proceeds = costBasisCents * (partner?.payoutPct ?? 0);
        const fee = proceeds * (partner?.feePct ?? 0);
        const cost = qty * SHIPPING_PER_UNIT_CENTS * 0.6;
        netRecoveryCents = proceeds - fee - cost;
        note = note || `Full lot bulk-liquidated via ${partner?.name} at ${pct(partner?.payoutPct)} of cost basis.`;
        break;
      }
      case "donation": {
        const cost = qty * (HANDLING_PER_UNIT_CENTS + SHIPPING_PER_UNIT_CENTS * 0.5);
        netRecoveryCents = -cost;
        note =
          note ||
          `Full lot donated via ${partner?.name}. No cash recovery; supports compliance and disposal-alternative documentation.`;
        break;
      }
      case "recycling": {
        const estWeightLb = nonResellableUnits * 0.9;
        const proceeds = estWeightLb * 18; // cents per lb
        const cost = nonResellableUnits * SHIPPING_PER_UNIT_CENTS * 0.4;
        netRecoveryCents = proceeds - cost;
        note = note || `${nonResellableUnits} non-resellable units to ${partner?.name} for certified fiber recycling.`;
        break;
      }
    }

    for (const rule of policyRules) {
      if (rule.approvalBelowRecoveryPct && (rule.category === "any" || rule.category === lot.category)) {
        if (netRecoveryCents < costBasisCents * (rule.approvalBelowRecoveryPct / 100)) {
          approvalNote = `Below ${rule.approvalBelowRecoveryPct}% of cost-basis recovery — requires named approval per "${rule.name}".`;
        }
      }
    }
  }

  const unitsAffected =
    outcome === "restock"
      ? likeNewUnits
      : outcome === "repair_resale"
      ? repairableUnits
      : outcome === "recycling"
      ? nonResellableUnits
      : qty;

  return {
    outcome,
    excludedReason,
    note,
    netRecoveryCents: Math.round(netRecoveryCents),
    partnerId: partner?.id ?? null,
    partnerName: partner?.name ?? null,
    approvalNote,
    unitsAffected,
  };
}

function pct(n?: number): string {
  if (n === undefined) return "—";
  return `${Math.round(n * 100)}%`;
}
