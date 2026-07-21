"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X, Moon, Sun } from "lucide-react";
import { signOut } from "@/app/actions";
import { FormButton } from "@/components/form-button";
const links=[["/dashboard","Dashboard"],["/tasks","Tasks"],["/customers","Customers"],["/invoices","Invoices"],["/inventory","Inventory"],["/employees","Employees"],["/transactions","Finances"],["/analytics","Analytics"],["/calendar","Calendar"],["/notifications","Notifications"],["/activity","Activity"],["/audit","Audit log"],["/assistant","Smart Assistant"],["/settings","Settings"]] as const;
export function Shell({children,company}:{children:React.ReactNode;company:string}){
 const pathname=usePathname(); const[open,setOpen]=useState(false); const[dark,setDark]=useState(false);
 useEffect(()=>{const v=localStorage.getItem("bizflow-theme")==="dark";setDark(v);document.documentElement.classList.toggle("dark",v)},[]);
 function toggle(){const v=!dark;setDark(v);localStorage.setItem("bizflow-theme",v?"dark":"light");document.documentElement.classList.toggle("dark",v)}
 const nav=<><div className="flex items-start justify-between"><div><Link href="/dashboard" className="text-2xl font-black">BizFlow</Link><p className="mt-1 text-sm text-slate-400">{company}</p></div><button className="md:hidden" onClick={()=>setOpen(false)}><X/></button></div><nav className="mt-6 grid gap-1">{links.map(([href,label])=>{const active=pathname===href||pathname.startsWith(href+"/");return <Link key={href} href={href} onClick={()=>setOpen(false)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${active?"bg-white text-slate-950":"hover:bg-slate-800"}`}>{label}</Link>})}</nav><div className="mt-6 grid gap-2"><button onClick={toggle} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-left text-sm">{dark?<Sun size={17}/>:<Moon size={17}/>} {dark?"Light mode":"Dark mode"}</button><form action={signOut}><FormButton className="w-full rounded-lg border border-slate-700 px-3 py-2 text-left">Sign out</FormButton></form></div></>;
 return <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]"><header className="sticky top-0 z-30 flex items-center justify-between border-b bg-slate-950 px-4 py-3 text-white md:hidden"><div><b>BizFlow</b><p className="text-xs text-slate-400">{company}</p></div><button onClick={()=>setOpen(true)}><Menu/></button></header><aside className="hidden border-r bg-slate-950 p-5 text-white md:block">{nav}</aside>{open&&<div className="fixed inset-0 z-50 md:hidden"><button className="absolute inset-0 bg-slate-950/60" onClick={()=>setOpen(false)}/><aside className="relative h-full w-72 overflow-y-auto bg-slate-950 p-5 text-white">{nav}</aside></div>}<main className="min-w-0 p-4 sm:p-5 md:p-8">{children}</main></div>
}
