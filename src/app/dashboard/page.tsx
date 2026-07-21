import { Shell } from '@/components/shell';
import { getWorkspace } from '@/lib/workspace';

export default async function Dashboard() {
  const w = await getWorkspace();
  const [{ count: tasks }, { count: customers }, { data: tx }, { count: employees }, { count: pendingLeave }] = await Promise.all([
    w.supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('company_id', w.companyId).neq('status', 'completed'),
    w.supabase.from('customers').select('*', { count: 'exact', head: true }).eq('company_id', w.companyId),
    w.supabase.from('transactions').select('type,amount').eq('company_id', w.companyId),
    w.supabase.from('employees').select('*', { count: 'exact', head: true }).eq('company_id', w.companyId).eq('status', 'active'),
    w.supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('company_id', w.companyId).eq('status', 'pending'),
  ]);
  const income = (tx ?? []).filter(x => x.type === 'income').reduce((s, x) => s + Number(x.amount), 0);
  const expenses = (tx ?? []).filter(x => x.type === 'expense').reduce((s, x) => s + Number(x.amount), 0);
  const cards = [['Open tasks', tasks ?? 0], ['Customers', customers ?? 0], ['Active employees', employees ?? 0], ['Pending leave', pendingLeave ?? 0], ['Income', `$${income.toFixed(2)}`], ['Expenses', `$${expenses.toFixed(2)}`]];
  return <Shell company={w.companyName}><h1 className="text-3xl font-black">Dashboard</h1><p className="mt-1 text-slate-600">A live overview of your company.</p><div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([l, v]) => <div className="card" key={l}><p className="text-sm font-bold text-slate-500">{l}</p><p className="mt-2 text-3xl font-black">{v}</p></div>)}</div><div className="card mt-6"><h2 className="text-xl font-black">Team operations</h2><p className="mt-2 text-slate-600">Open Employees to manage departments, payroll data, team status, and leave approvals.</p></div></Shell>;
}
