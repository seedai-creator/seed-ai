import type {Locale} from '@/lib/i18n/config';
const labels={
 'pt-BR':['Baixar meus dados','Dados da conta e, opcionalmente, da empresa da qual você é proprietário. O arquivo pode conter informações confidenciais. Guarde-o em local seguro.','Somente minha conta','Empresa','Confirme sua senha','Baixar arquivo JSON'],
 'pt-PT':['Descarregar os meus dados','Dados da conta e, opcionalmente, da empresa de que é proprietário. O ficheiro pode conter informações confidenciais. Guarde-o num local seguro.','Apenas a minha conta','Empresa','Confirme a sua palavra-passe','Descarregar ficheiro JSON'],
 'en-US':['Download my data','Account data and, optionally, data from a company you own. The file may contain confidential information. Store it securely.','My account only','Company','Confirm your password','Download JSON file'],
 'es-ES':['Descargar mis datos','Datos de la cuenta y, opcionalmente, de la empresa de la que eres propietario. El archivo puede contener información confidencial. Guárdalo en un lugar seguro.','Solo mi cuenta','Empresa','Confirma tu contraseña','Descargar archivo JSON'],
} as const;
export function PrivacyExportForm({locale,companies}:{locale:Locale;companies:{id:string;name:string}[]}){
 const c=labels[locale];
 return <section><h2>{c[0]}</h2><p>{c[1]}</p><form action="/api/privacy/export" method="post" className="account-form"><label>{c[3]}<select name="company"><option value="">{c[2]}</option>{companies.map(company=><option key={company.id} value={company.id}>{company.name}</option>)}</select></label><label>{c[4]}<input type="password" name="password" minLength={8} maxLength={128} autoComplete="current-password" required/></label><button className="primary-button">{c[5]}</button></form></section>;
}
