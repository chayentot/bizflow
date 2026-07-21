import { Shell } from '@/components/shell';
import { getWorkspace } from '@/lib/workspace';

type Transaction = {
  type: 'income' | 'expense';
  amount: number | string;
  category: string;
  transaction_date: string;
};

type Task = { status: string };

type MonthRow = {
  key: string;
  label: string;
  income: number;
  expenses: number;
};

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

function getLastSixMonths(): MonthRow[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      income: 0,
      expenses: 0,
    };
  });
}

export default async function ReportsPage() {
  const workspace = await getWorkspace();
  const [{ data: transactions }, { data: tasks }, { count: customers }] = await Promise.all([
    workspace.supabase
      .from('transactions')
      .select('type,amount,category,transaction_date')
      .eq('company_id', workspace.companyId)
      .order('transaction_date', { ascending: true }),
    workspace.supabase
      .from('tasks')
      .select('status')
      .eq('company_id', workspace.companyId),
    workspace.supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', workspace.companyId),
  ]);

  const tx = (transactions ?? []) as Transaction[];
  const taskRows = (tasks ?? []) as Task[];
  const income = tx.filter((item) => item.type === 'income').reduce((sum, item) => sum + Number(item.amount), 0);
  const expenses = tx.filter((item) => item.type === 'expense').reduce((sum, item) => sum + Number(item.amount), 0);
  const profit = income - expenses;
  const completedTasks = taskRows.filter((task) => task.status === 'completed').length;
  const completionRate = taskRows.length ? Math.round((completedTasks / taskRows.length) * 100) : 0;

  const months = getLastSixMonths();
  const monthMap = new Map(months.map((month) => [month.key, month]));
  tx.forEach((item) => {
    const month = monthMap.get(item.transaction_date.slice(0, 7));
    if (!month) return;
    if (item.type === 'income') month.income += Number(item.amount);
    else month.expenses += Number(item.amount);
  });

  const maxMonthValue = Math.max(1, ...months.flatMap((month) => [month.income, month.expenses]));
  const categoryTotals = new Map<string, number>();
  tx.filter((item) => item.type === 'expense').forEach((item) => {
    categoryTotals.set(item.category, (categoryTotals.get(item.category) ?? 0) + Number(item.amount));
  });
  const topExpenses = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const cards = [
    ['Total income', money.format(income)],
    ['Total expenses', money.format(expenses)],
    ['Net profit', money.format(profit)],
    ['Task completion', `${completionRate}%`],
  ];

  return (
    <Shell company={workspace.companyName}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">Reports</h1>
          <p className="mt-1 text-slate-600">Financial and operational performance at a glance.</p>
        </div>
        <p className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm">
          {customers ?? 0} customers · {taskRows.length} tasks
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <div className="card" key={label}>
            <p className="text-sm font-bold text-slate-500">{label}</p>
            <p className={`mt-2 text-3xl font-black ${label === 'Net profit' && profit < 0 ? 'text-red-600' : ''}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Income vs expenses</h2>
              <p className="text-sm text-slate-500">Last six months</p>
            </div>
            <div className="flex gap-4 text-sm font-bold text-slate-600">
              <span>■ Income</span><span>▥ Expenses</span>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-6 gap-3" style={{ minHeight: 260 }}>
            {months.map((month) => (
              <div className="flex min-w-0 flex-col justify-end" key={month.key}>
                <div className="flex h-48 items-end justify-center gap-1 rounded-lg bg-slate-50 px-2">
                  <div
                    className="w-1/2 rounded-t bg-slate-950"
                    title={`Income: ${money.format(month.income)}`}
                    style={{ height: `${Math.max(month.income ? 4 : 0, (month.income / maxMonthValue) * 100)}%` }}
                  />
                  <div
                    className="w-1/2 rounded-t border-2 border-slate-400 bg-white"
                    title={`Expenses: ${money.format(month.expenses)}`}
                    style={{ height: `${Math.max(month.expenses ? 4 : 0, (month.expenses / maxMonthValue) * 100)}%` }}
                  />
                </div>
                <p className="mt-2 truncate text-center text-xs font-bold text-slate-500">{month.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="text-xl font-black">Top expense categories</h2>
          <p className="text-sm text-slate-500">Highest spending categories</p>
          <div className="mt-6 space-y-4">
            {topExpenses.length ? topExpenses.map(([category, total]) => (
              <div key={category}>
                <div className="mb-1 flex justify-between gap-4 text-sm">
                  <span className="font-bold">{category}</span>
                  <span>{money.format(total)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-slate-900" style={{ width: `${expenses ? (total / expenses) * 100 : 0}%` }} />
                </div>
              </div>
            )) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Add expense transactions to see category analysis.</p>}
          </div>
        </section>
      </div>

      <section className="card mt-6">
        <h2 className="text-xl font-black">Business health</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-500">Profit margin</p>
            <p className="mt-1 text-2xl font-black">{income ? `${Math.round((profit / income) * 100)}%` : '0%'}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-500">Completed tasks</p>
            <p className="mt-1 text-2xl font-black">{completedTasks} / {taskRows.length}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-500">Average customer value</p>
            <p className="mt-1 text-2xl font-black">{money.format(customers ? income / customers : 0)}</p>
          </div>
        </div>
      </section>
    </Shell>
  );
}
