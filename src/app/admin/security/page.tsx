import Link from 'next/link';
import {notFound} from 'next/navigation';
import {adminIdentity} from '@/lib/commercial/server';
import {AdminMfaForm} from '@/components/admin-mfa-form';
export const dynamic='force-dynamic';
export default async function AdminSecurityPage(){
 const context=await adminIdentity().catch(()=>null);if(!context)notFound();
 const result=await context.supabase.auth.mfa.listFactors();
 return <main className="account-shell"><section className="account-card"><Link href="/">Voltar à SeedAI</Link><h1>Proteção da administração</h1><p>Use um aplicativo autenticador para confirmar o acesso ao painel e às alterações administrativas.</p>{result.error?<p role="alert">Não foi possível consultar seus autenticadores. Tente novamente.</p>:<AdminMfaForm factors={result.data.totp.map(f=>({id:f.id,name:f.friendly_name??'Autenticador'}))}/>}<p>Se perdeu o autenticador, procure o responsável pela conta Supabase para verificar sua identidade e recuperar o acesso. A senha sozinha não libera a administração.</p></section></main>;
}
