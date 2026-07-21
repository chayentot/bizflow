"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { signOut } from "@/app/actions";
import { FormButton } from "@/components/form-button";

const links = [
  ["/dashboard", "Dashboard"],
  ["/tasks", "Tasks"],
  ["/customers", "Customers"],
  ["/invoices", "Invoices"],
  ["/inventory", "Inventory"],
  ["/employees", "Employees"],
  ["/transactions", "Finances"],
  ["/reports", "Reports"],
] as const;

export function Shell({ children, company }: { children: React.ReactNode; company: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const navigation = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/dashboard" className="text-2xl font-black" onClick={() => setOpen(false)}>BizFlow</Link>
          <p className="mt-1 text-sm text-slate-400">{company}</p>
        </div>
        <button type="button" className="rounded-lg p-2 text-slate-300 md:hidden" onClick={() => setOpen(false)} aria-label="Close navigation">
          <X size={22} />
        </button>
      </div>
      <nav className="mt-8 grid gap-2">
        {links.map(([href, label]) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return <Link key={href} href={href} onClick={() => setOpen(false)} className={`rounded-lg px-3 py-2 transition ${active ? "bg-white text-slate-950" : "hover:bg-slate-800"}`}>{label}</Link>;
        })}
      </nav>
      <form action={signOut} className="mt-8">
        <FormButton className="w-full rounded-lg border border-slate-700 px-3 py-2 text-left disabled:opacity-60" pendingText="Signing out...">Sign out</FormButton>
      </form>
    </>
  );

  return <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
    <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-slate-950 px-4 py-3 text-white md:hidden">
      <div><p className="font-black">BizFlow</p><p className="max-w-56 truncate text-xs text-slate-400">{company}</p></div>
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-slate-700 p-2" aria-label="Open navigation"><Menu size={22}/></button>
    </header>
    <aside className="hidden border-r bg-slate-950 p-5 text-white md:block">{navigation}</aside>
    {open && <div className="fixed inset-0 z-50 md:hidden"><button type="button" aria-label="Close navigation overlay" className="absolute inset-0 bg-slate-950/60" onClick={() => setOpen(false)} /><aside className="relative h-full w-72 max-w-[85vw] overflow-y-auto bg-slate-950 p-5 text-white shadow-2xl">{navigation}</aside></div>}
    <main className="min-w-0 p-4 sm:p-5 md:p-8">{children}</main>
  </div>;
}
