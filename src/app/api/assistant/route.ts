import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type HistoryItem = { role?: string; content?: string };

function sum(rows: Array<{ amount?: number | string }> | null) {
  return (rows ?? []).reduce((total, row) => total + Number(row.amount ?? 0), 0);
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

    const snapshot = {
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

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY is not configured in Vercel. Add it under Project Settings → Environment Variables, then redeploy." }, { status: 503 });

    const history = Array.isArray(body.history) ? body.history.slice(-6).filter((item: HistoryItem) => item && typeof item.content === "string").map((item: HistoryItem) => `${item.role === "assistant" ? "Assistant" : "User"}: ${item.content}`) : [];
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        instructions: "You are BizFlow's business analyst. Answer only from the supplied workspace snapshot. Be concise, practical, and transparent when data is missing. Use short headings and bullets when useful. Never invent values. Do not expose raw JSON.",
        input: `Conversation:\n${history.join("\n")}\n\nCurrent question: ${question}\n\nWorkspace snapshot:\n${JSON.stringify(snapshot)}`,
        max_output_tokens: 700,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      const message = result?.error?.message || "The AI provider returned an error.";
      return NextResponse.json({ error: message }, { status: response.status });
    }
    const answer = result.output_text || result.output?.flatMap((item: any) => item.content ?? []).find((item: any) => item.type === "output_text")?.text;
    if (!answer) return NextResponse.json({ error: "The assistant returned an empty response." }, { status: 502 });
    return NextResponse.json({ answer });
  } catch (error) {
    console.error("Assistant error", error);
    return NextResponse.json({ error: "The assistant could not process this request." }, { status: 500 });
  }
}
