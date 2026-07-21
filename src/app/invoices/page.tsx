import Link from "next/link";
import { createInvoice } from "@/app/actions";
import { Shell } from "@/components/shell";
import { getWorkspace } from "@/lib/workspace";

const money = (value:number|string) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(value));

export default async function Invoices({searchParams}:{searchParams:Promise<{error?:string}>}) {
  const w = await getWorkspace();
  const q = await searchParams;
  const [{data:customers},{data:invoices}] = await Promise.all([
    w.supabase.from("customers").select("id,name,company_name").eq("company_id",w.companyId).order("name"),
    w.supabase.from("invoices").select("id,invoice_number,status,issue_date,due_date,total,customers(name,company_name)").eq("company_id",w.companyId).order("created_at",{ascending:false})
  ]);
  const today = new Date().toISOString().slice(0,10);
  const due = new Date(Date.now()+14*86400000).toISOString().slice(0,10);
  return <Shell company={w.companyName}>
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-black">Invoices</h1><p className="mt-1 text-slate-600">Create invoices and track payment status.</p></div></div>
    {q.error&&<p className="mt-4 rounded-lg bg-red-50 p-3 text-red-700">{q.error}</p>}
    <div className="mt-6 grid gap-6 xl:grid-cols-[390px_1fr]">
      <form action={createInvoice} className="card space-y-4">
        <h2 className="text-xl font-black">Create invoice</h2>
        {!customers?.length&&<p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Add a customer first.</p>}
        <label><span className="label">Customer</span><select name="customer_id" required disabled={!customers?.length}><option value="">Select customer</option>{customers?.map(c=><option key={c.id} value={c.id}>{c.name}{c.company_name?` — ${c.company_name}`:""}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-3"><label><span className="label">Issue date</span><input name="issue_date" type="date" defaultValue={today} required/></label><label><span className="label">Due date</span><input name="due_date" type="date" defaultValue={due} required/></label></div>
        <label><span className="label">Status</span><select name="status"><option value="draft">Draft</option><option value="sent">Sent</option><option value="paid">Paid</option></select></label>
        <label><span className="label">Service or item</span><input name="description" placeholder="Website development" required/></label>
        <div className="grid grid-cols-2 gap-3"><label><span className="label">Quantity</span><input name="quantity" type="number" min="1" step="1" defaultValue="1" required/></label><label><span className="label">Unit price</span><input name="unit_price" type="number" min="0" step="0.01" required/></label></div>
        <div className="grid grid-cols-2 gap-3"><label><span className="label">Tax %</span><input name="tax_rate" type="number" min="0" step="0.01" defaultValue="0"/></label><label><span className="label">Discount</span><input name="discount" type="number" min="0" step="0.01" defaultValue="0"/></label></div>
        <label><span className="label">Notes</span><textarea name="notes" rows={3} placeholder="Payment terms or thank-you note"/></label>
        <button className="btn w-full" disabled={!customers?.length}>Create invoice</button>
      </form>
      <section className="card overflow-x-auto p-0"><table className="w-full min-w-[700px] text-left"><thead className="border-b bg-slate-50 text-sm text-slate-600"><tr><th className="p-4">Invoice</th><th className="p-4">Customer</th><th className="p-4">Status</th><th className="p-4">Due</th><th className="p-4 text-right">Total</th></tr></thead><tbody>{invoices?.length?invoices.map(i=>{const c=i.customers as unknown as {name:string;company_name:string|null}|null; const overdue=i.status!=="paid"&&i.due_date<today; return <tr key={i.id} className="border-b last:border-0 hover:bg-slate-50"><td className="p-4 font-bold"><Link className="text-blue-700 hover:underline" href={`/invoices/${i.id}`}>{i.invoice_number}</Link></td><td className="p-4">{c?.company_name||c?.name||"Customer"}</td><td className="p-4"><span className={`rounded-full px-2 py-1 text-xs font-bold uppercase ${overdue?"bg-red-100 text-red-700":i.status==="paid"?"bg-emerald-100 text-emerald-700":"bg-slate-100"}`}>{overdue?"overdue":i.status}</span></td><td className="p-4">{i.due_date}</td><td className="p-4 text-right font-bold">{money(i.total)}</td></tr>}):<tr><td className="p-6 text-slate-500" colSpan={5}>No invoices yet.</td></tr>}</tbody></table></section>
    </div>
  </Shell>
}
