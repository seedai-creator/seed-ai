import {createSupabaseServer} from '@/lib/supabase/server';
import {boundedBody,trustedOrigin} from '@/lib/operations/http';
import {operationsEnabled} from '@/lib/operations/server';
import {validId,validPassword} from '@/lib/auth/validation';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
 const fail=(status:number,message:string)=>new Response(message,{status,headers});
 if(!operationsEnabled())return fail(404,'Indisponível.');
 if(!trustedOrigin(request,process.env.NEXT_PUBLIC_SITE_URL))return fail(403,'Solicitação recusada.');
 try{
  if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))return fail(400,'Solicitação inválida.');
  const form=new URLSearchParams(await boundedBody(request,4096));
  const password=form.get('password'),company=form.get('company')||null;
  if(!validPassword(password)||(company!==null&&!validId(company)))return fail(400,'Confira os dados e volte ao suporte.');
  const client=await createSupabaseServer(),identity=await client.auth.getUser();
  if(identity.error||!identity.data.user?.email)return fail(401,'Entre na sua conta novamente.');
  // The caller cannot provide another account's email or user ID.
  const reauthenticated=await client.auth.signInWithPassword({email:identity.data.user.email,password});
  if(reauthenticated.error||reauthenticated.data.user.id!==identity.data.user.id)return fail(403,'Não foi possível confirmar sua identidade.');
  const result=await client.rpc('export_private_data',{p_company:company});
  if(result.error)return fail(result.error.code==='54000'?429:403,'Não foi possível gerar o arquivo. Aguarde ou solicite a exportação pelo suporte.');
  return new Response(JSON.stringify(result.data,null,2),{headers:{...headers,'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="seed-data.json"'}});
 }catch{return fail(400,'Não foi possível gerar o arquivo. Volte ao suporte e tente novamente.');}
}
