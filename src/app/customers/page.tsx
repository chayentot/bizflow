import Link from "next/link";
import { deleteCustomer } from "@/app/actions";
import { Shell } from "@/components/shell";
import { EmptyState, PageHeader } from "@/components/page-header";
import { getWorkspace } from "@/lib/workspace";

export default async function Customers({searchParams}:{searchParams:Promise<{error?:string;q?:string}>}){
  const w=await getWorkspace(); const q=await searchParams; const term=(q.q??"").trim();
  let query=w.supabase.from("customers").select("*").eq("company_id",w.companyId).order("created_at",{ascending:false});
  if(term) query=query.or(`name.ilike.%${term}%,company_name.ilike.%${term}%,email.ilike.%${term}%`);
  const {data:items}=await query;
  return <Shell company={w.companyName}>
    <PageHeader title="Customers" description="View and manage your customer records." actionHref="/customers/new" actionLabel="Add customer"/>
    {q.error&&<p className="mt-4 rounded-lg bg-red-50 p-3 text-red-700">{q.error}</p>}
    <form className="mt-6 flex max-w-xl gap-2"><input name="q" defaultValue={term} placeholder="Search name, company, or email"/><button className="btn-secondary rounded-lg px-4 font-bold">Search</button>{term&&<Link className="rounded-lg px-3 py-2 text-sm font-bold" href="/customers">Clear</Link>}</form>
    <section className="card mt-6 overflow-x-auto p-0">
      {items?.length?<table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-4">Customer</th><th className="p-4">Contact</th><th className="p-4">Phone</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th></tr></thead><tbody>{items.map(c=><tr key={c.id} className="border-b last:border-0"><td className="p-4"><p className="font-black">{c.name}</p><p className="text-xs text-slate-500">{c.company_name||"Individual customer"}</p></td><td className="p-4">{c.email||"—"}</td><td className="p-4">{c.phone||"—"}</td><td className="p-4"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold uppercase">{c.status}</span></td><td className="p-4 text-right"><form action={deleteCustomer}><input type="hidden" name="id" value={c.id}/><button className="text-sm font-bold text-red-600">Delete</button></form></td></tr>)}</tbody></table>:<div className="p-6"><EmptyState title="No customers found" description={term?"Try another search.":"Add your first customer to start building your records."} href="/customers/new" label="Add customer"/></div>}
    </section>
  </Shell>;
}
