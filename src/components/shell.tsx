import Link from "next/link";
import { signOut } from "@/app/actions";
const links=[['/dashboard','Dashboard'],['/tasks','Tasks'],['/customers','Customers'],['/invoices','Invoices'],['/inventory','Inventory'],['/transactions','Finances'],['/reports','Reports']];
export function Shell({children,company}:{children:React.ReactNode;company:string}) { return <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
<aside className="border-r bg-slate-950 p-5 text-white"><Link href="/dashboard" className="text-2xl font-black">BizFlow</Link><p className="mt-1 text-sm text-slate-400">{company}</p><nav className="mt-8 grid gap-2">{links.map(([h,l])=><Link key={h} href={h} className="rounded-lg px-3 py-2 hover:bg-slate-800">{l}</Link>)}</nav><form action={signOut} className="mt-8"><button className="w-full rounded-lg border border-slate-700 px-3 py-2 text-left">Sign out</button></form></aside>
<main className="p-5 md:p-8">{children}</main></div> }
