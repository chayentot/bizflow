import { Shell } from "@/components/shell";
import { getWorkspace } from "@/lib/workspace";
import { createDepartment, createEmployee, createLeaveRequest, deleteEmployee, updateEmployeeStatus, updateLeaveStatus } from "@/app/actions";

type SearchParams = Promise<{ error?: string }>;

function money(value: number | string) {
  return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default async function EmployeesPage({ searchParams }: { searchParams: SearchParams }) {
  const w = await getWorkspace();
  const params = await searchParams;
  const [{ data: departments }, { data: employees }, { data: leaveRequests }] = await Promise.all([
    w.supabase.from("departments").select("id,name,description").eq("company_id", w.companyId).order("name"),
    w.supabase.from("employees").select("id,employee_number,first_name,last_name,email,phone,job_title,employment_type,status,hire_date,salary,department_id,departments(name)").eq("company_id", w.companyId).order("created_at", { ascending: false }),
    w.supabase.from("leave_requests").select("id,employee_id,leave_type,start_date,end_date,reason,status,employees(first_name,last_name)").eq("company_id", w.companyId).order("created_at", { ascending: false }).limit(20),
  ]);

  const staff = employees ?? [];
  const active = staff.filter(e => e.status === "active").length;
  const onLeave = staff.filter(e => e.status === "on_leave").length;
  const payroll = staff.filter(e => e.status !== "inactive").reduce((sum, e) => sum + Number(e.salary), 0);
  const pending = (leaveRequests ?? []).filter(r => r.status === "pending").length;
  const today = new Date().toISOString().slice(0, 10);

  return <Shell company={w.companyName}>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-3xl font-black">Employees</h1><p className="mt-1 text-slate-600">Manage your team, departments, employment status, and leave requests.</p></div>
    </div>

    {params.error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">{params.error}</div>}

    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[["Active employees", active], ["On leave", onLeave], ["Pending leave", pending], ["Monthly payroll", money(payroll)]].map(([name, value]) =>
        <div className="card" key={name}><p className="text-sm font-bold text-slate-500">{name}</p><p className="mt-2 text-3xl font-black">{value}</p></div>
      )}
    </div>

    <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_.8fr]">
      <section className="card overflow-x-auto">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black">Team directory</h2><p className="text-sm text-slate-500">{staff.length} employee{staff.length === 1 ? "" : "s"}</p></div></div>
        {staff.length === 0 ? <p className="mt-6 rounded-xl bg-slate-50 p-6 text-center text-slate-500">Add your first employee using the form.</p> :
        <table className="mt-5 w-full min-w-[850px] text-left text-sm">
          <thead className="border-b text-xs uppercase tracking-wide text-slate-500"><tr><th className="pb-3">Employee</th><th className="pb-3">Role</th><th className="pb-3">Department</th><th className="pb-3">Type</th><th className="pb-3">Salary</th><th className="pb-3">Status</th><th className="pb-3 text-right">Action</th></tr></thead>
          <tbody>{staff.map(employee => {
            const department = employee.departments as unknown as { name: string } | null;
            return <tr className="border-b last:border-0" key={employee.id}>
              <td className="py-4"><p className="font-black">{employee.first_name} {employee.last_name}</p><p className="text-xs text-slate-500">{employee.employee_number} · {employee.email || "No email"}</p></td>
              <td className="py-4 font-semibold">{employee.job_title}</td><td className="py-4">{department?.name ?? "Unassigned"}</td><td className="py-4">{label(employee.employment_type)}</td><td className="py-4">{money(employee.salary)}</td>
              <td className="py-4"><form action={updateEmployeeStatus} className="flex gap-2"><input type="hidden" name="id" value={employee.id}/><select name="status" defaultValue={employee.status} className="min-w-28 py-1 text-xs"><option value="active">Active</option><option value="on_leave">On leave</option><option value="inactive">Inactive</option></select><button className="btn-secondary rounded-lg px-2 text-xs font-bold">Save</button></form></td>
              <td className="py-4 text-right"><form action={deleteEmployee}><input type="hidden" name="id" value={employee.id}/><button className="font-bold text-red-600">Delete</button></form></td>
            </tr>})}</tbody>
        </table>}
      </section>

      <div className="grid gap-6">
        <section className="card"><h2 className="text-xl font-black">Add employee</h2><form action={createEmployee} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label><span className="label">Employee ID</span><input name="employee_number" placeholder="EMP-001" required/></label>
          <label><span className="label">Department</span><select name="department_id"><option value="">Unassigned</option>{(departments ?? []).map(d => <option value={d.id} key={d.id}>{d.name}</option>)}</select></label>
          <label><span className="label">First name</span><input name="first_name" required/></label><label><span className="label">Last name</span><input name="last_name" required/></label>
          <label><span className="label">Email</span><input type="email" name="email"/></label><label><span className="label">Phone</span><input name="phone"/></label>
          <label className="sm:col-span-2"><span className="label">Job title</span><input name="job_title" placeholder="Operations Manager" required/></label>
          <label><span className="label">Employment type</span><select name="employment_type"><option value="full_time">Full time</option><option value="part_time">Part time</option><option value="contract">Contract</option><option value="intern">Intern</option></select></label>
          <label><span className="label">Status</span><select name="status"><option value="active">Active</option><option value="on_leave">On leave</option><option value="inactive">Inactive</option></select></label>
          <label><span className="label">Hire date</span><input type="date" name="hire_date" defaultValue={today} required/></label><label><span className="label">Monthly salary</span><input type="number" min="0" step="0.01" name="salary" defaultValue="0" required/></label>
          <button className="btn sm:col-span-2">Add employee</button>
        </form></section>

        <section className="card"><h2 className="text-xl font-black">Add department</h2><form action={createDepartment} className="mt-4 grid gap-3"><label><span className="label">Department name</span><input name="name" placeholder="Sales" required/></label><label><span className="label">Description</span><textarea name="description" rows={2}/></label><button className="btn">Create department</button></form></section>
      </div>
    </div>

    <div className="mt-6 grid gap-6 xl:grid-cols-[.8fr_1.4fr]">
      <section className="card"><h2 className="text-xl font-black">New leave request</h2>{staff.length === 0 ? <p className="mt-4 text-slate-500">Add an employee before creating leave requests.</p> : <form action={createLeaveRequest} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className="label">Employee</span><select name="employee_id" required>{staff.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}</select></label>
        <label><span className="label">Leave type</span><select name="leave_type"><option value="vacation">Vacation</option><option value="sick">Sick</option><option value="personal">Personal</option><option value="parental">Parental</option><option value="other">Other</option></select></label>
        <div></div><label><span className="label">Start date</span><input type="date" name="start_date" defaultValue={today} required/></label><label><span className="label">End date</span><input type="date" name="end_date" defaultValue={today} required/></label>
        <label className="sm:col-span-2"><span className="label">Reason</span><textarea name="reason" rows={3}/></label><button className="btn sm:col-span-2">Submit leave request</button>
      </form>}</section>

      <section className="card overflow-x-auto"><h2 className="text-xl font-black">Leave requests</h2>{(leaveRequests ?? []).length === 0 ? <p className="mt-5 rounded-xl bg-slate-50 p-6 text-center text-slate-500">No leave requests yet.</p> :
      <table className="mt-5 w-full min-w-[700px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-slate-500"><tr><th className="pb-3">Employee</th><th className="pb-3">Type</th><th className="pb-3">Dates</th><th className="pb-3">Reason</th><th className="pb-3">Status</th></tr></thead><tbody>{(leaveRequests ?? []).map(request => {
        const employee = request.employees as unknown as { first_name: string; last_name: string } | null;
        return <tr className="border-b last:border-0" key={request.id}><td className="py-4 font-black">{employee ? `${employee.first_name} ${employee.last_name}` : "Employee"}</td><td className="py-4">{label(request.leave_type)}</td><td className="py-4">{request.start_date} → {request.end_date}</td><td className="max-w-52 truncate py-4 text-slate-600">{request.reason || "—"}</td><td className="py-4"><form action={updateLeaveStatus} className="flex gap-2"><input type="hidden" name="id" value={request.id}/><input type="hidden" name="employee_id" value={request.employee_id}/><select name="status" defaultValue={request.status} className="min-w-28 py-1 text-xs"><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select><button className="btn-secondary rounded-lg px-2 text-xs font-bold">Save</button></form></td></tr>})}</tbody></table>}
      </section>
    </div>
  </Shell>;
}
