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
  if (error) redirect(`/tasks?error=${encodeURIComponent(error.message)}`); revalidatePath("/tasks"); revalidatePath("/dashboard");
}
export async function toggleTask(formData: FormData) {
  const ctx = await companyId(); const id=text(formData,"id"), current=text(formData,"status");
  await ctx.supabase.from("tasks").update({ status: current === "completed" ? "todo" : "completed" }).eq("id",id).eq("company_id",ctx.companyId); revalidatePath("/tasks"); revalidatePath("/dashboard");
}
export async function deleteTask(formData: FormData) { const ctx=await companyId(); await ctx.supabase.from("tasks").delete().eq("id",text(formData,"id")).eq("company_id",ctx.companyId); revalidatePath("/tasks"); revalidatePath("/dashboard"); }

export async function createCustomer(formData: FormData) {
  const ctx=await companyId(); const { error }=await ctx.supabase.from("customers").insert({ company_id:ctx.companyId,name:text(formData,"name"),email:text(formData,"email")||null,phone:text(formData,"phone")||null,company_name:text(formData,"company_name")||null,status:text(formData,"status") });
  if(error) redirect(`/customers?error=${encodeURIComponent(error.message)}`); revalidatePath("/customers"); revalidatePath("/dashboard");
}
export async function deleteCustomer(formData: FormData) { const ctx=await companyId(); await ctx.supabase.from("customers").delete().eq("id",text(formData,"id")).eq("company_id",ctx.companyId); revalidatePath("/customers"); revalidatePath("/dashboard"); }

export async function createTransaction(formData: FormData) {
  const ctx=await companyId(); const { error }=await ctx.supabase.from("transactions").insert({ company_id:ctx.companyId,type:text(formData,"type"),category:text(formData,"category"),amount:Number(text(formData,"amount")),description:text(formData,"description")||null,transaction_date:text(formData,"transaction_date"),created_by:ctx.user.id });
  if(error) redirect(`/transactions?error=${encodeURIComponent(error.message)}`); revalidatePath("/transactions"); revalidatePath("/dashboard");
}
export async function deleteTransaction(formData: FormData) { const ctx=await companyId(); await ctx.supabase.from("transactions").delete().eq("id",text(formData,"id")).eq("company_id",ctx.companyId); revalidatePath("/transactions"); revalidatePath("/dashboard"); }
