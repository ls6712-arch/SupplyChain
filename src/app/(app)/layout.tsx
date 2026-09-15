import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../auth/actions";

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/lots", label: "Lots" },
  { href: "/partners", label: "Partner directory" },
  { href: "/rules", label: "Policy rules" },
  { href: "/reports", label: "Reports" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Every page under this layout requires a session. RLS still protects
  // the data itself -- this redirect is a UX guard, not the security
  // boundary, so it's fine for it to be a simple check like this.
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <nav className="w-[212px] shrink-0 bg-paperDim border-r border-hairline flex flex-col py-5 sticky top-0 h-screen overflow-y-auto">
        <div className="px-5 pb-4 border-b border-hairline mb-3">
          <div className="font-serif text-lg font-bold">Manifest</div>
          <div className="text-inkSoft text-[11.5px] mt-1">Disposition workspace</div>
        </div>
        {navLinks.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="px-5 py-2 text-[13.5px] text-inkSoft hover:bg-paper hover:text-ink border-l-2 border-transparent"
          >
            {l.label}
          </Link>
        ))}
        <div className="mt-auto px-5 pt-3 border-t border-hairline">
          <div className="text-[11.5px] text-inkSoft mb-2 truncate" title={user.email ?? undefined}>
            {user.email}
          </div>
          <form action={signOut}>
            <button type="submit" className="text-[11.5px] text-inkSoft underline underline-offset-2">
              Sign out
            </button>
          </form>
        </div>
      </nav>
      <main className="flex-1 min-w-0 px-10 py-8 max-w-[1180px]">{children}</main>
    </div>
  );
}
