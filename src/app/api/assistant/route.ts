import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Row = Record<string, any>;

type Snapshot = {
  company: string;
  generated_on: string;
  financial_summary: { income: number; expenses: number; net_profit: number };
  invoices: { total: number; overdue: Row[]; recent_or_upcoming: Row[] };
  inventory: { products: number; low_stock: Row[]; lowest_stock_items: Row[] };
  tasks: { total: number; open: Row[] };
  customers: { total: number; recent: Row[] };
  employees: { total: number; records: Row[] };
  leave_requests: Row[];
};

function sum(rows: Array<{ amount?: number | string }> | null) {
  return (rows ?? []).reduce((total, row) => total + Number(row.amount ?? 0), 0);
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function customerName(invoice: Row) {
  const customer = invoice.customers;
  if (Array.isArray(customer)) return customer[0]?.name ?? "Unknown customer";
  return customer?.name ?? "Unknown customer";
}

function employeeName(row: Row) {
  const employee = row.employees;
  const record = Array.isArray(employee) ? employee[0] : employee;
  return [record?.first_name, record?.last_name].filter(Boolean).join(" ") || "Unknown employee";
}

function builtInAnswer(question: string, snapshot: Snapshot) {
  const q = question.toLowerCase();
  const finance = snapshot.financial_summary;
  const overdue = snapshot.invoices.overdue;
  const lowStock = snapshot.inventory.low_stock;
  const openTasks = snapshot.tasks.open;
  const customers = snapshot.customers.recent;
  const employees = snapshot.employees.records;
  const leave = snapshot.leave_requests;

  if (/who.*customer|list.*customer|customer.*right now|customers do i have/.test(q)) {
    if (!customers.length) return "You do not have any customers yet.";
    return `You currently have ${snapshot.customers.total} customer${snapshot.customers.total === 1 ? "" : "s"}:\n${customers.map((row) => `• ${row.name}${row.email ? ` — ${row.email}` : ""}`).join("\n")}`;
  }

  if (/overdue|invoice.*attention|unpaid/.test(q)) {
    if (!overdue.length) return "Good news: there are no overdue invoices right now.";
    const total = overdue.reduce((value, row) => value + Number(row.total ?? 0), 0);
    return `${overdue.length} overdue invoice${overdue.length === 1 ? " needs" : "s need"} attention, totaling ${money(total)}:\n${overdue.map((row) => `• ${row.invoice_number} — ${customerName(row)} — ${money(Number(row.total ?? 0))} — due ${row.due_date}`).join("\n")}`;
  }

  if (/low.*stock|restock|inventory.*low|out of stock/.test(q)) {
    if (!lowStock.length) return "No products are currently at or below their low-stock threshold.";
    return `${lowStock.length} product${lowStock.length === 1 ? " is" : "s are"} low in stock:\n${lowStock.map((row) => `• ${row.name}${row.sku ? ` (${row.sku})` : ""} — ${row.quantity} remaining; threshold ${row.low_stock_threshold}`).join("\n")}`;
  }

  if (/profit|revenue|income|expense|financial|performance/.test(q)) {
    return `Financial summary for the available transaction data:\n• Income: ${money(finance.income)}\n• Expenses: ${money(finance.expenses)}\n• Net profit: ${money(finance.net_profit)}\n• Profit margin: ${finance.income > 0 ? `${((finance.net_profit / finance.income) * 100).toFixed(1)}%` : "Not available because income is zero"}`;
  }

  if (/task|focus|today|priority|todo|to do/.test(q)) {
    const highPriority = openTasks.filter((row) => String(row.priority).toLowerCase() === "high");
    const items = (highPriority.length ? highPriority : openTasks).slice(0, 8);
    const lines = [
      overdue.length ? `Contact customers about ${overdue.length} overdue invoice${overdue.length === 1 ? "" : "s"}.` : "No overdue invoices require attention.",
      lowStock.length ? `Restock ${lowStock.length} low-stock product${lowStock.length === 1 ? "" : "s"}.` : "Inventory has no low-stock alerts.",
      items.length ? `Work on these open tasks:\n${items.map((row) => `• ${row.title}${row.priority ? ` — ${row.priority} priority` : ""}${row.due_date ? ` — due ${row.due_date}` : ""}`).join("\n")}` : "There are no open tasks.",
    ];
    return `Recommended focus:\n${lines.map((line) => `• ${line}`).join("\n")}`;
  }

  if (/employee|staff|team/.test(q)) {
    if (!employees.length) return "There are no employee records yet.";
    return `You have ${snapshot.employees.total} employee record${snapshot.employees.total === 1 ? "" : "s"}:\n${employees.map((row) => `• ${row.first_name} ${row.last_name}${row.job_title ? ` — ${row.job_title}` : ""} — ${row.status ?? "unknown status"}`).join("\n")}`;
  }

  if (/leave|vacation|absent/.test(q)) {
    const relevant = leave.filter((row) => ["approved", "pending"].includes(String(row.status).toLowerCase()));
    if (!relevant.length) return "There are no pending or approved leave requests in the current data.";
    return `${relevant.length} leave request${relevant.length === 1 ? "" : "s"}:\n${relevant.map((row) => `• ${employeeName(row)} — ${row.leave_type} — ${row.start_date} to ${row.end_date} — ${row.status}`).join("\n")}`;
  }

  if (/summary|summarize|business/.test(q)) {
    return `${snapshot.company} snapshot:\n• ${snapshot.customers.total} customers\n• ${snapshot.tasks.open.length} open tasks\n• ${snapshot.invoices.total} invoices, including ${overdue.length} overdue\n• ${snapshot.inventory.products} products, including ${lowStock.length} low-stock\n• ${snapshot.employees.total} employees\n• Income ${money(finance.income)}, expenses ${money(finance.expenses)}, net profit ${money(finance.net_profit)}\n\nSuggested priority: ${overdue.length ? "follow up on overdue invoices" : lowStock.length ? "restock low inventory" : openTasks.length ? "complete open tasks" : "your key operational alerts are clear"}.`;
  }

  return "I can answer questions about customers, finances, overdue invoices, low-stock products, tasks, employees, leave requests, and business summaries. Try: “What should I focus on today?”";
}

async function askOllama(question: string, snapshot: Snapshot) {
  const baseUrl = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL || "llama3.2:3b",
      stream: false,
      messages: [
        { role: "system", content: "You are BizFlow's private local business analyst. Answer only from the supplied workspace snapshot. Be concise and never invent values." },
        { role: "user", content: `Question: ${question}\n\nWorkspace snapshot:\n${JSON.stringify(snapshot)}` },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
  const data = await response.json();
  const answer = data?.message?.content;
  if (!answer) throw new Error("Ollama returned an empty response");
  return answer as string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question || question.length > 500) return NextResponse.json({ error: "Enter a question up to 500 characters." }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

    const { data: membership } = await supabase.from("company_members").select("company_id, companies(name)").eq("user_id", user.id).limit(1).maybeSingle();
    if (!membership) return NextResponse.json({ error: "No company workspace was found." }, { status: 404 });
    const companyId = membership.company_id as string;
    const company = membership.companies as unknown as { name?: string } | null;

    const [transactionsResult, invoicesResult, productsResult, tasksResult, customersResult, employeesResult, leaveResult] = await Promise.all([
      supabase.from("transactions").select("type,amount,category,transaction_date").eq("company_id", companyId).order("transaction_date", { ascending: false }).limit(200),
      supabase.from("invoices").select("invoice_number,status,total,due_date,customers(name)").eq("company_id", companyId).order("due_date", { ascending: true }).limit(100),
      supabase.from("products").select("name,sku,quantity,low_stock_threshold,cost_price,selling_price").eq("company_id", companyId).order("quantity", { ascending: true }).limit(100),
      supabase.from("tasks").select("title,status,priority,due_date").eq("company_id", companyId).order("due_date", { ascending: true }).limit(100),
      supabase.from("customers").select("name,email,created_at").eq("company_id", companyId).order("created_at", { ascending: false }).limit(100),
      supabase.from("employees").select("first_name,last_name,job_title,status").eq("company_id", companyId).limit(100),
      supabase.from("leave_requests").select("leave_type,start_date,end_date,status,employees(first_name,last_name)").eq("company_id", companyId).order("start_date", { ascending: true }).limit(100),
    ]);

    const transactions = transactionsResult.data ?? [];
    const income = sum(transactions.filter((row) => row.type === "income"));
    const expenses = sum(transactions.filter((row) => row.type === "expense"));
    const today = new Date().toISOString().slice(0, 10);
    const invoices = invoicesResult.data ?? [];
    const overdueInvoices = invoices.filter((row) => row.due_date && row.due_date < today && !["paid", "cancelled"].includes(String(row.status).toLowerCase()));
    const lowStock = (productsResult.data ?? []).filter((row) => Number(row.quantity) <= Number(row.low_stock_threshold));
    const openTasks = (tasksResult.data ?? []).filter((row) => String(row.status).toLowerCase() !== "completed");

    const snapshot: Snapshot = {
      company: company?.name ?? "My Company",
      generated_on: today,
      financial_summary: { income, expenses, net_profit: income - expenses },
      invoices: { total: invoices.length, overdue: overdueInvoices, recent_or_upcoming: invoices.slice(0, 25) },
      inventory: { products: productsResult.data?.length ?? 0, low_stock: lowStock, lowest_stock_items: (productsResult.data ?? []).slice(0, 25) },
      tasks: { total: tasksResult.data?.length ?? 0, open: openTasks.slice(0, 30) },
      customers: { total: customersResult.data?.length ?? 0, recent: (customersResult.data ?? []).slice(0, 20) },
      employees: { total: employeesResult.data?.length ?? 0, records: (employeesResult.data ?? []).slice(0, 30) },
      leave_requests: (leaveResult.data ?? []).slice(0, 30),
    };

    if ((process.env.ASSISTANT_PROVIDER || "builtin").toLowerCase() === "ollama") {
      try {
        const answer = await askOllama(question, snapshot);
        return NextResponse.json({ answer, provider: "ollama" });
      } catch (error) {
        console.error("Ollama unavailable; using built-in assistant", error);
      }
    }

    return NextResponse.json({ answer: builtInAnswer(question, snapshot), provider: "builtin" });
  } catch (error) {
    console.error("Assistant error", error);
    return NextResponse.json({ error: "The assistant could not process this request." }, { status: 500 });
  }
}
