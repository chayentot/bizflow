import Link from "next/link";
import { notFound } from "next/navigation";
import { updateCustomer } from "@/app/actions";
import { Shell } from "@/components/shell";
import { FormButton } from "@/components/form-button";
import { getWorkspace } from "@/lib/workspace";

export default async function EditCustomer({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string}>}){
  const w=await getWorkspace(); const {id}=await params; const q=await searchParams;
  const {data:customer}=await w.supabase.from("customers").select("*").eq("id",id).eq("company_id",w.companyId).single();
  if(!customer) notFound();
  return <Shell company={w.companyName}><div className="max-w-2xl">
    <Link className="text-sm font-bold text-slate-600" href="/customers">← Back to customers</Link>
    <h1 className="mt-4 text-3xl font-black">Edit customer</h1>
    <p className="mt-1 text-slate-600">Update customer information. The customer ID cannot be changed.</p>
    {q.error&&<p className="mt-4 rounded-lg bg-red-50 p-3 text-red-700">{q.error}</p>}
    <form action={updateCustomer} className="card mt-6 grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={customer.id}/>
      <label className="sm:col-span-2"><span className="label">Customer ID</span><input value={customer.customer_number||"Not assigned"} readOnly disabled className="bg-slate-100 font-semibold text-slate-500"/></label>
      <label className="sm:col-span-2"><span className="label">Name</span><input name="name" defaultValue={customer.name} required/></label>
      <label className="sm:col-span-2"><span className="label">Business</span><input name="company_name" defaultValue={customer.company_name||""}/></label>
      <label><span className="label">Email</span><input name="email" type="email" defaultValue={customer.email||""}/></label>
      <label><span className="label">Phone</span><input name="phone" defaultValue={customer.phone||""}/></label>
      <label className="sm:col-span-2"><span className="label">Status</span><select name="status" defaultValue={customer.status}><option value="lead">Lead</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
      <div className="flex gap-3 sm:col-span-2"><FormButton pendingText="Saving changes...">Save changes</FormButton><Link className="btn-secondary rounded-lg px-4 py-2 font-bold" href="/customers">Cancel</Link></div>
    </form>
  </div></Shell>;
}
