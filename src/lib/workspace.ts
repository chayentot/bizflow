import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
export async function getWorkspace() {
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect('/login');
 const {data:membership}=await supabase.from('company_members').select('company_id, companies(name)').eq('user_id',user.id).limit(1).maybeSingle(); if(!membership) redirect('/setup');
 const companies=membership.companies as unknown as {name:string}|null;
 return {supabase,user,companyId:membership.company_id as string,companyName:companies?.name ?? 'My Company'};
}
