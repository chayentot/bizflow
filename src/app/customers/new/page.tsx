import Link from "next/link";
import { createCustomer } from "@/app/actions";
import { Shell } from "@/components/shell";
import { FormButton } from "@/components/form-button";
import { getWorkspace } from "@/lib/workspace";

export default async function NewCustomer({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const w = await getWorkspace();
  const q = await searchParams;
  return <Shell company={w.companyName}>
    <div className="max-w-2xl">
      <Link className="text-sm font-bold text-slate-600" href="/customers">← Back to customers</Link>
      <h1 className="mt-4 text-3xl font-black">Add customer</h1>
      <p className="mt-1 text-slate-600">The customer ID is generated automatically after saving and cannot be changed.</p>
      {q.error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-red-700">{q.error}</p>}
      <form action={createCustomer} className="card mt-6 grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className="label">Customer ID</span><input value="Generated after saving" readOnly disabled className="bg-slate-100 text-slate-500" /></label>
        <label className="sm:col-span-2"><span className="label">Name</span><input name="name" required /></label>
        <label className="sm:col-span-2"><span className="label">Business</span><input name="company_name" /></label>
        <label><span className="label">Email</span><input name="email" type="email" /></label>
        <label><span className="label">Phone</span><input name="phone" /></label>
        <label className="sm:col-span-2"><span className="label">Status</span><select name="status"><option value="lead">Lead</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        <div className="flex gap-3 sm:col-span-2"><FormButton pendingText="Saving customer...">Save customer</FormButton><Link className="btn-secondary rounded-lg px-4 py-2 font-bold" href="/customers">Cancel</Link></div>
      </form>
    </div>
  </Shell>;
}
