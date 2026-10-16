"use server";
import { companyContext } from "@/lib/auth/context";
import { commercialDatabase } from "@/lib/commercial/server";
import { validId } from "@/lib/auth/validation";
import type { MemoryItem } from "@/lib/memory/automatic";
import { freeExperienceForUser } from '@/lib/commercial/free-experience-server';
export async function workspaceData(companyId:string){
 const c=await companyContext(companyId),db=commercialDatabase();
 // Commercial availability controls new AI work, never access to saved records.
 const [conversations,memories,usage]=await Promise.all([
  db.from("conversations").select("id,title,version,updated_at").eq("company_id",c.companyId).eq("user_id",c.userId).order("updated_at",{ascending:false}).limit(100),
  db.from("business_memories").select("*").eq("company_id",c.companyId).eq("deleted",false).order("updated_at",{ascending:false}).limit(200),
  freeExperienceForUser(c.userId).then(free=>({available:true,free}),()=>({available:false,free:null})),
 ]);
 if(conversations.error||memories.error)throw Error("WORKSPACE_UNAVAILABLE");
 return {conversations:conversations.data as {id:string;title:string;version:number;updated_at:string}[],memories:memories.data as MemoryItem[],freeExperience:usage.free,usageAvailable:usage.available};
}
export async function readConversation(companyId:string,id:string){
 const c=await companyContext(companyId),db=commercialDatabase();
 if(!validId(id))throw Error("INVALID_CONVERSATION");
 const {data,error}=await db.from("conversations").select("id,version").eq("id",id).eq("company_id",c.companyId).eq("user_id",c.userId).single();
 if(error||!data)throw Error("CONVERSATION_UNAVAILABLE");
 const messages=await db.from("messages").select("role,content,diagnosis,created_at").eq("conversation_id",id).order("created_at").order("role",{ascending:false}).limit(22);
 if(messages.error)throw Error("CONVERSATION_UNAVAILABLE");
 return {version:data.version as number,messages:messages.data as {role:"user"|"assistant";content:string;diagnosis:unknown}[]};
}
export async function editMemory(companyId:string,id:string,version:number,value:string,remove:boolean){
 const c=await companyContext(companyId);
 if(!validId(id)||!Number.isSafeInteger(version)||version<1||value.length>500)throw Error("INVALID_MEMORY");
 const {error}=await c.supabase.rpc("edit_business_memory",{p_company:companyId,p_id:id,p_version:version,p_value:value,p_delete:remove});
 if(error)throw Error("MEMORY_CHANGED");
}
