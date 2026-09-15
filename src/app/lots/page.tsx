import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LotsTable } from "../components";

export default async function LotsPage() {
  const supabase = await createClient();
  const organizationId = "00000000-0000-0000-0000-000000000001";

  const { data: lots } = await supabase
    .from("inventory_lots")
    .select("*, products(*), settlements(*)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-semibold">Inventory lots</h1>
          <div className="text-inkSoft text-sm mt-1">Every lot moving through the disposition workflow.</div>
        </div>
        <Link href="/lots/new" className="bg-denim text-white text-[12.5px] font-medium py-2 px-3.5 rounded-sm">
          + New lot
        </Link>
      </div>
      <LotsTable lots={lots ?? []} />
    </div>
  );
}
