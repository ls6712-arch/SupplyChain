"use client";

import { useState, useTransition } from "react";
import { runRecommendation, approveRecommendation, markExecuting, reconcileLot } from "../../actions";
import { fmtDollarsFromCents } from "../../components";

export function RunRecommendationButton({ lotId }: { lotId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => startTransition(() => runRecommendation(lotId).then(() => window.location.reload()))}
      className="bg-denim text-white text-[13px] font-medium py-2 px-4 rounded-sm disabled:opacity-50"
    >
      {pending ? "Running…" : "Run recommendation"}
    </button>
  );
}

export function ApproveButton({
  lotId,
  recommendationId,
  outcome,
  isOverride,
  label,
}: {
  lotId: string;
  recommendationId: string;
  outcome: string;
  isOverride: boolean;
  label: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    let reason: string | null = null;
    if (isOverride) {
      reason = window.prompt("This is an override of the top recommendation. Enter a reason (required):");
      if (!reason) return;
    }
    startTransition(() =>
      approveRecommendation(lotId, recommendationId, outcome as any, isOverride, reason).then(() =>
        window.location.reload()
      )
    );
  }

  return (
    <button
      disabled={pending}
      onClick={handleClick}
      className="border border-denim text-denim text-[11px] font-medium py-1.5 px-2.5 rounded-sm disabled:opacity-50"
    >
      {pending ? "…" : label}
    </button>
  );
}

export function ExecutionPanel({ lot, settlement, recommendation }: { lot: any; settlement: any; recommendation: any }) {
  const [pending, startTransition] = useTransition();
  const [proceeds, setProceeds] = useState("0");
  const [costs, setCosts] = useState("0");

  if (lot.status === "approved") {
    return (
      <div className="mb-8">
        <div className="font-medium text-sm mb-3">Execution</div>
        <div className="border border-hairline rounded-sm p-5">
          <p className="text-sm mb-3">
            Approved: <strong>{lot.chosen_outcome}</strong>
            {lot.override_reason ? ` (override — ${lot.override_reason})` : ""}. Next: coordinate pickup and handoff.
          </p>
          <button
            disabled={pending}
            onClick={() =>
              startTransition(() =>
                markExecuting(lot.id, null, lot.facility_id).then(() => window.location.reload())
              )
            }
            className="bg-denim text-white text-[13px] font-medium py-2 px-4 rounded-sm disabled:opacity-50"
          >
            {pending ? "…" : "Mark shipped / handoff in progress"}
          </button>
        </div>
      </div>
    );
  }

  if (lot.status === "in_execution") {
    return (
      <div className="mb-8">
        <div className="font-medium text-sm mb-3">Execution</div>
        <div className="border border-hairline rounded-sm p-5">
          <p className="text-sm mb-4">
            In execution via <strong>{lot.chosen_outcome}</strong>. Enter final settlement figures to reconcile and
            close the lot.
          </p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-[11.5px] text-inkSoft mb-1">Actual proceeds ($)</label>
              <input
                type="number"
                value={proceeds}
                onChange={(e) => setProceeds(e.target.value)}
                className="w-full border border-hairline rounded-sm p-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11.5px] text-inkSoft mb-1">Actual costs / fees ($)</label>
              <input
                type="number"
                value={costs}
                onChange={(e) => setCosts(e.target.value)}
                className="w-full border border-hairline rounded-sm p-2 text-sm"
              />
            </div>
          </div>
          <button
            disabled={pending}
            onClick={() =>
              startTransition(() =>
                reconcileLot(lot.id, Math.round(parseFloat(proceeds) * 100), Math.round(parseFloat(costs) * 100), 0).then(
                  () => window.location.reload()
                )
              )
            }
            className="bg-denim text-white text-[13px] font-medium py-2 px-4 rounded-sm disabled:opacity-50"
          >
            {pending ? "…" : "Reconcile & close lot"}
          </button>
        </div>
      </div>
    );
  }

  if (lot.status === "closed" && settlement) {
    return (
      <div className="mb-8">
        <div className="font-medium text-sm mb-3">Execution</div>
        <div className="grid grid-cols-3 gap-px bg-hairline border border-hairline rounded-sm overflow-hidden">
          <div className="bg-paper p-4">
            <div className="text-[11px] text-inkSoft mb-1.5">Final outcome</div>
            <div className="text-[15px] font-semibold">{lot.chosen_outcome}</div>
          </div>
          <div className="bg-paper p-4">
            <div className="text-[11px] text-inkSoft mb-1.5">Net recovery</div>
            <div className="font-mono text-lg font-semibold">{fmtDollarsFromCents(settlement.net_recovery_cents)}</div>
          </div>
          <div className="bg-paper p-4">
            <div className="text-[11px] text-inkSoft mb-1.5">vs. baseline</div>
            <div className="font-mono text-lg font-semibold">
              {fmtDollarsFromCents(settlement.net_recovery_cents - (recommendation?.baseline_net_recovery_cents ?? 0))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
