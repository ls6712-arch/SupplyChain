import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Manifest — Disposition Workflow",
  description: "Disposition orchestration for fashion inventory.",
};

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/lots", label: "Lots" },
  { href: "/partners", label: "Partner directory" },
  { href: "/rules", label: "Policy rules" },
  { href: "/reports", label: "Reports" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen">
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
        </nav>
        <main className="flex-1 min-w-0 px-10 py-8 max-w-[1180px]">{children}</main>
      </body>
    </html>
  );
}
