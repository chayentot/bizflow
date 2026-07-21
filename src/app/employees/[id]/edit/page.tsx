import Link from "next/link";
import { notFound } from "next/navigation";
import { updateEmployee } from "@/app/actions";
import { Shell } from "@/components/shell";
import { FormButton } from "@/components/form-button";
import { getWorkspace } from "@/lib/workspace";

export default async function EditEmployee({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string}>}){
  const w=await getWorkspace(); const {id}=await params; const q=await searchParams;
  const [{data:employee},{data:departments}]=await Promise.all([
    w.supabase.from("employees").select("*").eq("id",id).eq("company_id",w.companyId).single(),
    w.supabase.from("departments").select("id,name").eq("company_id",w.companyId).order("name")
  ]);
  if(!employee) notFound();
  return <Shell company={w.companyName}><div className="max-w-3xl">
    <Link className="text-sm font-bold text-slate-600" href="/employees">← Back to employees</Link>
    <h1 className="mt-4 text-3xl font-black">Edit employee</h1>
    <p className="mt-1 text-slate-600">Update employment details. The employee number is permanent and cannot be changed.</p>
    {q.error&&<p className="mt-4 rounded-lg bg-red-50 p-3 text-red-700">{q.error}</p>}
    <form action={updateEmployee} className="card mt-6 grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={employee.id}/>
      <label><span className="label">Employee number</span><input value={employee.employee_number||"Not assigned"} readOnly disabled className="bg-slate-100 font-semibold text-slate-500"/></label>
      <label><span className="label">Department</span><select name="department_id" defaultValue={employee.department_id||""}><option value="">Unassigned</option>{departments?.map(d=><option value={d.id} key={d.id}>{d.name}</option>)}</select></label>
      <label><span className="label">First name</span><input name="first_name" defaultValue={employee.first_name} required/></label>
      <label><span className="label">Last name</span><input name="last_name" defaultValue={employee.last_name} required/></label>
      <label><span className="label">Email</span><input type="email" name="email" defaultValue={employee.email||""}/></label>
      <label><span className="label">Phone</span><input name="phone" defaultValue={employee.phone||""}/></label>
      <label className="sm:col-span-2"><span className="label">Job title</span><input name="job_title" defaultValue={employee.job_title} required/></label>
      <label><span className="label">Employment type</span><select name="employment_type" defaultValue={employee.employment_type}><option value="full_time">Full time</option><option value="part_time">Part time</option><option value="contract">Contract</option><option value="intern">Intern</option></select></label>
      <label><span className="label">Status</span><select name="status" defaultValue={employee.status}><option value="active">Active</option><option value="on_leave">On leave</option><option value="inactive">Inactive</option></select></label>
      <label><span className="label">Hire date</span><input type="date" name="hire_date" defaultValue={employee.hire_date} required/></label>
      <label><span className="label">Monthly salary</span><input type="number" min="0" step="0.01" name="salary" defaultValue={employee.salary} required/></label>
      <div className="flex gap-3 sm:col-span-2"><FormButton pendingText="Saving changes...">Save changes</FormButton><Link className="btn-secondary rounded-lg px-4 py-2 font-bold" href="/employees">Cancel</Link></div>
    </form>
  </div></Shell>;
}
