"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createLot } from "../../actions";

const ORG_ID = "00000000-0000-0000-0000-000000000001";
const FACILITY_ID = "REPLACE_WITH_YOUR_SEEDED_FACILITY_ID"; // see supabase/migrations/0001_init.sql

export default function NewLotPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    formData.set("organizationId", ORG_ID);
    formData.set("facilityId", FACILITY_ID);
    try {
      const lotId = await createLot(formData);
      router.push(`/lots/${lotId}`);
    } catch (e: any) {
      setError(e.message ?? "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="font-serif text-2xl font-semibold mb-1">New inventory lot</h1>
      <p className="text-inkSoft text-sm mb-6">
        Enter what you know today. The recommendation engine runs after intake, not during it.
      </p>

      <form action={handleSubmit} className="space-y-4">
        <Field label="Category">
          <select name="category" className="w-full border border-hairline rounded-sm p-2 text-sm">
            <option value="dress">Dress</option>
            <option value="top">Top</option>
            <option value="denim">Denim</option>
            <option value="outerwear">Outerwear</option>
            <option value="accessory">Accessory</option>
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity">
            <input name="quantity" type="number" defaultValue={200} min={1} className="w-full border border-hairline rounded-sm p-2 text-sm" />
          </Field>
          <Field label="Reason code">
            <select name="sourceType" className="w-full border border-hairline rounded-sm p-2 text-sm">
              <option value="customer_return">Customer return</option>
              <option value="aged_inventory">Aged inventory</option>
              <option value="damaged">Damaged</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Cost basis / unit ($)">
            <input name="costBasis" type="number" step="0.01" defaultValue={24} className="w-full border border-hairline rounded-sm p-2 text-sm" />
          </Field>
          <Field label="Retail value / unit ($)">
            <input name="retailValue" type="number" step="0.01" defaultValue={98} className="w-full border border-hairline rounded-sm p-2 text-sm" />
          </Field>
        </div>

        <fieldset className="border border-hairline rounded-sm p-4">
          <legend className="text-xs text-inkSoft px-1">Condition mix (must total 100%)</legend>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Like-new %">
              <input name="likeNewPct" type="number" defaultValue={60} className="w-full border border-hairline rounded-sm p-2 text-sm" />
            </Field>
            <Field label="Repairable %">
              <input name="repairablePct" type="number" defaultValue={25} className="w-full border border-hairline rounded-sm p-2 text-sm" />
            </Field>
            <Field label="Non-resellable %">
              <input name="nonResellablePct" type="number" defaultValue={15} className="w-full border border-hairline rounded-sm p-2 text-sm" />
            </Field>
          </div>
        </fieldset>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isCapsule" />
          Capsule / collaboration SKU (extra brand-protection gate)
        </label>

        {error && <div className="text-clay text-sm">{error}</div>}

        <button
          type="submit"
          disabled={pending}
          className="bg-denim text-white text-[13px] font-medium py-2 px-4 rounded-sm disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create lot"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11.5px] text-inkSoft mb-1">{label}</label>
      {children}
    </div>
  );
}
