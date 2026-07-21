"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function text(formData: FormData, key: string) { return String(formData.get(key) ?? "").trim(); }

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const email = text(formData, "email");
  const password = text(formData, "password");
  const fullName = text(formData, "full_name");
  const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  redirect("/setup?message=Check your email if confirmation is enabled.");
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: text(formData, "email"), password: text(formData, "password") });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/dashboard");
}

export async function signOut() { const supabase = await createClient(); await supabase.auth.signOut(); redirect("/"); }

export async function createCompany(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data, error } = await supabase.from("companies").insert({ name: text(formData, "name"), industry: text(formData, "industry"), created_by: user.id }).select("id").single();
  if (error) redirect(`/setup?error=${encodeURIComponent(error.message)}`);
  const member = await supabase.from("company_members").insert({ company_id: data.id, user_id: user.id, role: "owner" });
  if (member.error) redirect(`/setup?error=${encodeURIComponent(member.error.message)}`);
  redirect("/dashboard");
}

async function companyId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("company_members").select("company_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!data) redirect("/setup");
  return { supabase, user, companyId: data.company_id as string };
}

export async function createTask(formData: FormData) {
  const ctx = await companyId();
  const { error } = await ctx.supabase.from("tasks").insert({ company_id: ctx.companyId, title: text(formData,"title"), description: text(formData,"description"), status: text(formData,"status"), priority: text(formData,"priority"), due_date: text(formData,"due_date") || null, created_by: ctx.user.id });
  if (error) redirect(`/tasks/new?error=${encodeURIComponent(error.message)}`); revalidatePath("/tasks"); revalidatePath("/dashboard"); redirect("/tasks");
}
export async function toggleTask(formData: FormData) {
  const ctx = await companyId(); const id=text(formData,"id"), current=text(formData,"status");
  await ctx.supabase.from("tasks").update({ status: current === "completed" ? "todo" : "completed" }).eq("id",id).eq("company_id",ctx.companyId); revalidatePath("/tasks"); revalidatePath("/dashboard");
}
export async function deleteTask(formData: FormData) { const ctx=await companyId(); await ctx.supabase.from("tasks").delete().eq("id",text(formData,"id")).eq("company_id",ctx.companyId); revalidatePath("/tasks"); revalidatePath("/dashboard"); }

export async function createCustomer(formData: FormData) {
  const ctx=await companyId(); const { error }=await ctx.supabase.from("customers").insert({ company_id:ctx.companyId,name:text(formData,"name"),email:text(formData,"email")||null,phone:text(formData,"phone")||null,company_name:text(formData,"company_name")||null,status:text(formData,"status") });
  if(error) redirect(`/customers/new?error=${encodeURIComponent(error.message)}`); revalidatePath("/customers"); revalidatePath("/dashboard"); redirect("/customers");
}
export async function updateCustomer(formData: FormData) {
  const ctx = await companyId();
  const id = text(formData, "id");
  const { error } = await ctx.supabase.from("customers").update({
    name: text(formData, "name"),
    email: text(formData, "email") || null,
    phone: text(formData, "phone") || null,
    company_name: text(formData, "company_name") || null,
    status: text(formData, "status"),
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("company_id", ctx.companyId);
  if (error) redirect(`/customers/${id}/edit?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/customers"); revalidatePath("/dashboard");
  redirect("/customers");
}

export async function deleteCustomer(formData: FormData) { const ctx=await companyId(); await ctx.supabase.from("customers").delete().eq("id",text(formData,"id")).eq("company_id",ctx.companyId); revalidatePath("/customers"); revalidatePath("/dashboard"); }

export async function createTransaction(formData: FormData) {
  const ctx=await companyId(); const { error }=await ctx.supabase.from("transactions").insert({ company_id:ctx.companyId,type:text(formData,"type"),category:text(formData,"category"),amount:Number(text(formData,"amount")),description:text(formData,"description")||null,transaction_date:text(formData,"transaction_date"),created_by:ctx.user.id });
  if(error) redirect(`/transactions/new?error=${encodeURIComponent(error.message)}`); revalidatePath("/transactions"); revalidatePath("/dashboard"); redirect("/transactions");
}
export async function deleteTransaction(formData: FormData) { const ctx=await companyId(); await ctx.supabase.from("transactions").delete().eq("id",text(formData,"id")).eq("company_id",ctx.companyId); revalidatePath("/transactions"); revalidatePath("/dashboard"); }

export async function createProduct(formData: FormData) {
  const ctx = await companyId();
  const quantity = Math.max(0, Number(text(formData, "quantity")) || 0);
  const { data: product, error } = await ctx.supabase.from("products").insert({
    company_id: ctx.companyId, name: text(formData, "name"), sku: text(formData, "sku").toUpperCase(),
    barcode: text(formData, "barcode") || null, description: text(formData, "description") || null,
    cost: Math.max(0, Number(text(formData, "cost")) || 0),
    selling_price: Math.max(0, Number(text(formData, "selling_price")) || 0),
    quantity, low_stock_threshold: Math.max(0, Number(text(formData, "low_stock_threshold")) || 0),
    created_by: ctx.user.id,
  }).select("id").single();
  if (error) redirect(`/inventory/new?error=${encodeURIComponent(error.message)}`);
  if (quantity > 0) await ctx.supabase.from("stock_movements").insert({ company_id: ctx.companyId, product_id: product.id, movement_type: "initial", quantity_change: quantity, note: "Opening stock", created_by: ctx.user.id });
  revalidatePath("/inventory");
  redirect("/inventory");
}

export async function adjustStock(formData: FormData) {
  const ctx = await companyId();
  const id = text(formData, "id");
  const change = Number(text(formData, "quantity_change"));
  if (!Number.isFinite(change) || change === 0) redirect("/inventory?error=Enter+a+non-zero+stock+change");
  const { data: product, error: readError } = await ctx.supabase.from("products").select("quantity").eq("id", id).eq("company_id", ctx.companyId).single();
  if (readError || !product) redirect("/inventory?error=Product+not+found");
  const nextQuantity = Number(product.quantity) + change;
  if (nextQuantity < 0) redirect("/inventory?error=Stock+cannot+go+below+zero");
  const { error } = await ctx.supabase.from("products").update({ quantity: nextQuantity, updated_at: new Date().toISOString() }).eq("id", id).eq("company_id", ctx.companyId);
  if (error) redirect(`/inventory?error=${encodeURIComponent(error.message)}`);
  await ctx.supabase.from("stock_movements").insert({ company_id: ctx.companyId, product_id: id, movement_type: change > 0 ? "restock" : "adjustment", quantity_change: change, note: text(formData, "note") || null, created_by: ctx.user.id });
  revalidatePath("/inventory"); revalidatePath("/invoices");
}

export async function deleteProduct(formData: FormData) {
  const ctx = await companyId();
  const { error } = await ctx.supabase.from("products").delete().eq("id", text(formData, "id")).eq("company_id", ctx.companyId);
  if (error) redirect(`/inventory?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/inventory"); revalidatePath("/invoices");
}

export async function createInvoice(formData: FormData) {
  const ctx = await companyId();
  const customerId = text(formData, "customer_id");
  const productId = text(formData, "product_id");
  const quantity = Math.max(1, Number(text(formData, "quantity")) || 1);
  let description = text(formData, "description");
  let unitPrice = Math.max(0, Number(text(formData, "unit_price")) || 0);
  let product: { id: string; name: string; selling_price: number|string; quantity: number|string } | null = null;
  if (productId) {
    const result = await ctx.supabase.from("products").select("id,name,selling_price,quantity").eq("id", productId).eq("company_id", ctx.companyId).single();
    if (result.error || !result.data) redirect("/invoices/new?error=Selected+product+was+not+found");
    product = result.data;
    if (Number(product.quantity) < quantity) redirect(`/invoices/new?error=${encodeURIComponent(`Only ${product.quantity} units are in stock`)}`);
    description = description || product.name;
    if (unitPrice === 0) unitPrice = Number(product.selling_price);
  }
  if (!description) redirect("/invoices/new?error=Enter+an+item+description+or+select+a+product");
  const taxRate = Math.max(0, Number(text(formData, "tax_rate")) || 0);
  const discount = Math.max(0, Number(text(formData, "discount")) || 0);
  const subtotal = quantity * unitPrice;
  const tax = subtotal * (taxRate / 100);
  const total = Math.max(0, subtotal + tax - discount);
  const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;

  const { data: invoice, error } = await ctx.supabase.from("invoices").insert({
    company_id: ctx.companyId,
    customer_id: customerId,
    invoice_number: invoiceNumber,
    status: text(formData, "status") || "draft",
    issue_date: text(formData, "issue_date"),
    due_date: text(formData, "due_date"),
    subtotal,
    tax,
    discount,
    total,
    notes: text(formData, "notes") || null,
    created_by: ctx.user.id,
  }).select("id").single();

  if (error) redirect(`/invoices/new?error=${encodeURIComponent(error.message)}`);
  const item = await ctx.supabase.from("invoice_items").insert({
    invoice_id: invoice.id,
    product_id: product?.id || null,
    description,
    quantity,
    unit_price: unitPrice,
    total: subtotal,
  });
  if (item.error) redirect(`/invoices/new?error=${encodeURIComponent(item.error.message)}`);
  if (product) {
    const nextQuantity = Number(product.quantity) - quantity;
    const stockUpdate = await ctx.supabase.from("products").update({ quantity: nextQuantity, updated_at: new Date().toISOString() }).eq("id", product.id).eq("company_id", ctx.companyId);
    if (stockUpdate.error) redirect(`/invoices?error=${encodeURIComponent(stockUpdate.error.message)}`);
    await ctx.supabase.from("stock_movements").insert({ company_id: ctx.companyId, product_id: product.id, movement_type: "sale", quantity_change: -quantity, note: invoiceNumber, created_by: ctx.user.id });
  }
  revalidatePath("/invoices"); revalidatePath("/inventory"); revalidatePath("/dashboard"); revalidatePath("/reports");
  redirect(`/invoices/${invoice.id}`);
}

export async function updateInvoiceStatus(formData: FormData) {
  const ctx = await companyId();
  const id = text(formData, "id");
  await ctx.supabase.from("invoices").update({ status: text(formData, "status") }).eq("id", id).eq("company_id", ctx.companyId);
  revalidatePath(`/invoices/${id}`); revalidatePath("/invoices"); revalidatePath("/dashboard");
}

export async function addPayment(formData: FormData) {
  const ctx = await companyId();
  const invoiceId = text(formData, "invoice_id");
  const amount = Number(text(formData, "amount"));
  const { error } = await ctx.supabase.from("payments").insert({
    invoice_id: invoiceId,
    amount,
    payment_date: text(formData, "payment_date"),
    payment_method: text(formData, "payment_method"),
    reference: text(formData, "reference") || null,
    notes: text(formData, "notes") || null,
    created_by: ctx.user.id,
  });
  if (error) redirect(`/invoices/${invoiceId}?error=${encodeURIComponent(error.message)}`);

  const { data: invoice } = await ctx.supabase.from("invoices").select("total").eq("id", invoiceId).eq("company_id", ctx.companyId).single();
  const { data: payments } = await ctx.supabase.from("payments").select("amount").eq("invoice_id", invoiceId);
  const paid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  if (invoice && paid >= Number(invoice.total)) {
    await ctx.supabase.from("invoices").update({ status: "paid" }).eq("id", invoiceId).eq("company_id", ctx.companyId);
  }
  revalidatePath(`/invoices/${invoiceId}`); revalidatePath("/invoices"); revalidatePath("/dashboard"); revalidatePath("/reports");
}

export async function deleteInvoice(formData: FormData) {
  const ctx = await companyId();
  await ctx.supabase.from("invoices").delete().eq("id", text(formData, "id")).eq("company_id", ctx.companyId);
  revalidatePath("/invoices"); revalidatePath("/dashboard"); revalidatePath("/reports");
  redirect("/invoices");
}

export async function createDepartment(formData: FormData) {
  const ctx = await companyId();
  const { error } = await ctx.supabase.from("departments").insert({
    company_id: ctx.companyId,
    name: text(formData, "name"),
    description: text(formData, "description") || null,
    created_by: ctx.user.id,
  });
  if (error) redirect(`/employees/departments/new?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/employees");
  redirect("/employees");
}

export async function createEmployee(formData: FormData) {
  const ctx = await companyId();
  const { error } = await ctx.supabase.from("employees").insert({
    company_id: ctx.companyId,
    department_id: text(formData, "department_id") || null,
    first_name: text(formData, "first_name"),
    last_name: text(formData, "last_name"),
    email: text(formData, "email") || null,
    phone: text(formData, "phone") || null,
    job_title: text(formData, "job_title"),
    employment_type: text(formData, "employment_type") || "full_time",
    status: text(formData, "status") || "active",
    hire_date: text(formData, "hire_date"),
    salary: Math.max(0, Number(text(formData, "salary")) || 0),
    created_by: ctx.user.id,
  });
  if (error) redirect(`/employees/new?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/employees"); revalidatePath("/dashboard");
  redirect("/employees");
}

export async function updateEmployee(formData: FormData) {
  const ctx = await companyId();
  const id = text(formData, "id");
  const { error } = await ctx.supabase.from("employees").update({
    department_id: text(formData, "department_id") || null,
    first_name: text(formData, "first_name"),
    last_name: text(formData, "last_name"),
    email: text(formData, "email") || null,
    phone: text(formData, "phone") || null,
    job_title: text(formData, "job_title"),
    employment_type: text(formData, "employment_type") || "full_time",
    status: text(formData, "status") || "active",
    hire_date: text(formData, "hire_date"),
    salary: Math.max(0, Number(text(formData, "salary")) || 0),
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("company_id", ctx.companyId);
  if (error) redirect(`/employees/${id}/edit?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/employees"); revalidatePath("/dashboard");
  redirect("/employees");
}

export async function updateEmployeeStatus(formData: FormData) {
  const ctx = await companyId();
  const { error } = await ctx.supabase.from("employees").update({
    status: text(formData, "status"),
    updated_at: new Date().toISOString(),
  }).eq("id", text(formData, "id")).eq("company_id", ctx.companyId);
  if (error) redirect(`/employees/leave/new?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/employees"); revalidatePath("/dashboard");
  redirect("/employees");
}

export async function deleteEmployee(formData: FormData) {
  const ctx = await companyId();
  const { error } = await ctx.supabase.from("employees").delete().eq("id", text(formData, "id")).eq("company_id", ctx.companyId);
  if (error) redirect(`/employees?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/employees"); revalidatePath("/dashboard");
}

export async function createLeaveRequest(formData: FormData) {
  const ctx = await companyId();
  const startDate = text(formData, "start_date");
  const endDate = text(formData, "end_date");
  if (endDate < startDate) redirect("/employees/leave/new?error=Leave+end+date+must+be+after+the+start+date");
  const { error } = await ctx.supabase.from("leave_requests").insert({
    company_id: ctx.companyId,
    employee_id: text(formData, "employee_id"),
    leave_type: text(formData, "leave_type"),
    start_date: startDate,
    end_date: endDate,
    reason: text(formData, "reason") || null,
    status: "pending",
    created_by: ctx.user.id,
  });
  if (error) redirect(`/employees/leave/new?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/employees"); revalidatePath("/dashboard");
  redirect("/employees");
}

export async function updateLeaveStatus(formData: FormData) {
  const ctx = await companyId();
  const id = text(formData, "id");
  const status = text(formData, "status");
  const { error } = await ctx.supabase.from("leave_requests").update({ status }).eq("id", id).eq("company_id", ctx.companyId);
  if (error) redirect(`/employees?error=${encodeURIComponent(error.message)}`);

  const employeeId = text(formData, "employee_id");
  if (status === "approved") {
    await ctx.supabase.from("employees").update({ status: "on_leave", updated_at: new Date().toISOString() }).eq("id", employeeId).eq("company_id", ctx.companyId);
  }
  revalidatePath("/employees"); revalidatePath("/dashboard");
}
