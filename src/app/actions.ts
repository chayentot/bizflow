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

export async function markNotificationRead(formData: FormData) {
  const ctx = await companyId();
  await ctx.supabase.from("notifications").update({ is_read: true }).eq("id", text(formData,"id")).eq("company_id",ctx.companyId);
  revalidatePath("/notifications");
}
export async function markAllNotificationsRead() {
  const ctx = await companyId();
  await ctx.supabase.from("notifications").update({ is_read: true }).eq("company_id",ctx.companyId).eq("is_read",false);
  revalidatePath("/notifications");
}
export async function createCalendarEvent(formData: FormData) {
  const ctx = await companyId();
  const { error } = await ctx.supabase.from("calendar_events").insert({
    company_id:ctx.companyId,title:text(formData,"title"),event_type:text(formData,"event_type"),
    start_at:text(formData,"start_at"),end_at:text(formData,"end_at")||null,description:text(formData,"description")||null,created_by:ctx.user.id
  });
  if(error) redirect(`/calendar?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/calendar"); redirect("/calendar");
}
export async function deleteCalendarEvent(formData: FormData) {
  const ctx=await companyId(); await ctx.supabase.from("calendar_events").delete().eq("id",text(formData,"id")).eq("company_id",ctx.companyId); revalidatePath("/calendar");
}
export async function updateCompanySettings(formData: FormData) {
  const ctx=await companyId();
  const {error}=await ctx.supabase.from("company_settings").upsert({company_id:ctx.companyId,currency:text(formData,"currency")||"USD",tax_rate:Number(text(formData,"tax_rate"))||0,timezone:text(formData,"timezone")||"UTC",address:text(formData,"address")||null,phone:text(formData,"phone")||null,email:text(formData,"email")||null,website:text(formData,"website")||null,updated_at:new Date().toISOString()});
  if(error) redirect(`/settings?error=${encodeURIComponent(error.message)}`); revalidatePath("/settings"); redirect("/settings?message=Settings+saved");
}


export async function createSupplier(formData: FormData) {
  const ctx=await companyId();
  const {error}=await ctx.supabase.from("suppliers").insert({company_id:ctx.companyId,supplier_number:"",name:text(formData,"name"),contact_name:text(formData,"contact_name")||null,email:text(formData,"email")||null,phone:text(formData,"phone")||null,address:text(formData,"address")||null,tax_number:text(formData,"tax_number")||null,payment_terms:text(formData,"payment_terms")||"Net 30",status:text(formData,"status")||"active",created_by:ctx.user.id});
  if(error) redirect(`/suppliers/new?error=${encodeURIComponent(error.message)}`); revalidatePath("/suppliers"); redirect("/suppliers");
}
export async function updateSupplier(formData: FormData) {
  const ctx=await companyId(); const id=text(formData,"id");
  const {error}=await ctx.supabase.from("suppliers").update({name:text(formData,"name"),contact_name:text(formData,"contact_name")||null,email:text(formData,"email")||null,phone:text(formData,"phone")||null,address:text(formData,"address")||null,tax_number:text(formData,"tax_number")||null,payment_terms:text(formData,"payment_terms")||"Net 30",status:text(formData,"status")||"active",updated_at:new Date().toISOString()}).eq("id",id).eq("company_id",ctx.companyId);
  if(error) redirect(`/suppliers/${id}/edit?error=${encodeURIComponent(error.message)}`); revalidatePath("/suppliers"); redirect("/suppliers");
}
export async function createPurchaseOrder(formData: FormData) {
 const ctx=await companyId(); const qty=Math.max(1,Number(text(formData,"quantity"))||1),cost=Math.max(0,Number(text(formData,"unit_cost"))||0),taxRate=Math.max(0,Number(text(formData,"tax_rate"))||0); const subtotal=qty*cost,tax=subtotal*taxRate/100,total=subtotal+tax;
 const {data:product}=await ctx.supabase.from("products").select("name").eq("id",text(formData,"product_id")).eq("company_id",ctx.companyId).single();
 const {data:po,error}=await ctx.supabase.from("purchase_orders").insert({company_id:ctx.companyId,supplier_id:text(formData,"supplier_id"),po_number:"",status:text(formData,"status")||"ordered",order_date:text(formData,"order_date"),expected_date:text(formData,"expected_date")||null,subtotal,tax,total,notes:text(formData,"notes")||null,created_by:ctx.user.id}).select("id").single();
 if(error||!po) redirect(`/purchasing/new?error=${encodeURIComponent(error?.message||"Could not create purchase order")}`);
 const item=await ctx.supabase.from("purchase_order_items").insert({purchase_order_id:po.id,product_id:text(formData,"product_id"),description:text(formData,"description")||product?.name||"Product",quantity:qty,unit_cost:cost});
 if(item.error) redirect(`/purchasing/new?error=${encodeURIComponent(item.error.message)}`); revalidatePath("/purchasing"); redirect(`/purchasing/${po.id}`);
}
export async function receivePurchaseOrder(formData: FormData) {
 const ctx=await companyId(); const id=text(formData,"id"); const {error}=await ctx.supabase.rpc("receive_purchase_order",{p_purchase_order_id:id,p_actor:ctx.user.id});
 if(error) redirect(`/purchasing/${id}?error=${encodeURIComponent(error.message)}`); revalidatePath("/purchasing");revalidatePath("/inventory");revalidatePath("/payables");revalidatePath("/dashboard");redirect(`/purchasing/${id}?message=Goods+received`);
}
export async function addSupplierPayment(formData: FormData) {
 const ctx=await companyId(); const billId=text(formData,"supplier_bill_id"); const {error}=await ctx.supabase.from("supplier_payments").insert({company_id:ctx.companyId,supplier_bill_id:billId,amount:Number(text(formData,"amount")),payment_date:text(formData,"payment_date"),method:text(formData,"method"),reference:text(formData,"reference")||null,created_by:ctx.user.id});
 if(error) redirect(`/payables?error=${encodeURIComponent(error.message)}`); revalidatePath("/payables");revalidatePath("/dashboard");redirect("/payables?message=Payment+recorded");
}
export async function createAutomationRule(formData: FormData) {
 const ctx=await companyId(); const {error}=await ctx.supabase.from("automation_rules").insert({company_id:ctx.companyId,name:text(formData,"name"),trigger_type:text(formData,"trigger_type"),action_type:text(formData,"action_type"),created_by:ctx.user.id});
 if(error) redirect(`/automations?error=${encodeURIComponent(error.message)}`); revalidatePath("/automations");redirect("/automations");
}
export async function toggleAutomationRule(formData: FormData) {
 const ctx=await companyId(); await ctx.supabase.from("automation_rules").update({is_enabled:text(formData,"enabled")!=="true"}).eq("id",text(formData,"id")).eq("company_id",ctx.companyId); revalidatePath("/automations");
}
export async function runAutomations() {
 const ctx=await companyId(); const {data:rules}=await ctx.supabase.from("automation_rules").select("*").eq("company_id",ctx.companyId).eq("is_enabled",true); let count=0;
 for(const rule of rules??[]){ let message=""; let href="/dashboard";
  if(rule.trigger_type==="low_stock"){const {data}=await ctx.supabase.from("products").select("name,quantity,low_stock_threshold").eq("company_id",ctx.companyId);const low=(data??[]).filter(p=>Number(p.quantity)<=Number(p.low_stock_threshold));if(low.length){message=`${low.length} product(s) need restocking`;href="/inventory";}}
  if(rule.trigger_type==="invoice_overdue"){const {count:c}=await ctx.supabase.from("invoices").select("id",{count:"exact",head:true}).eq("company_id",ctx.companyId).lt("due_date",new Date().toISOString().slice(0,10)).neq("status","paid");if(c){message=`${c} invoice(s) are overdue`;href="/invoices";}}
  if(rule.trigger_type==="task_due"){const {count:c}=await ctx.supabase.from("tasks").select("id",{count:"exact",head:true}).eq("company_id",ctx.companyId).lte("due_date",new Date().toISOString().slice(0,10)).neq("status","completed");if(c){message=`${c} task(s) are due`;href="/tasks";}}
  if(message){await ctx.supabase.from("notifications").insert({company_id:ctx.companyId,type:"warning",title:rule.name,message,href});await ctx.supabase.from("automation_runs").insert({company_id:ctx.companyId,rule_id:rule.id,message});count++;}
 }
 revalidatePath("/automations");revalidatePath("/notifications");redirect(`/automations?message=${count}+automation(s)+created+notifications`);
}
