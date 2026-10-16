import {translator,type MessageKey} from '../i18n/messages';
import {formatCurrency,formatDate,formatNumber} from '../i18n/format';
import type {Locale} from '../i18n/config';
import type {Amount} from '../goals/domain';
type CopyKey=Extract<MessageKey,`cockpit.${string}`> extends `cockpit.${infer K}`?K:never;
export function cockpitText(locale:Locale){const t=translator(locale);return (key:CopyKey)=>t(`cockpit.${key}` as MessageKey);}
export function amountText(value:Amount|null,unit:string|null,currency:string|null,locale:Locale){
 if(!value)return cockpitText(locale)('unknown');
 const number=(v:number)=>unit==='money'&&currency?formatCurrency(v,currency,locale):formatNumber(v,locale)+(unit==='percent'?'%':'');
 const text=value.value!==null?number(value.value):value.min!==null&&value.max!==null?number(value.min)+' – '+number(value.max):null;
 return text?(value.approximate?'≈ ':'')+text:cockpitText(locale)('unknown');
}
export const dateText=(value:string,locale:Locale)=>formatDate(value.length===10?value+'T12:00:00Z':value,locale,'UTC');
export function compactText(value:unknown,max=300){const s=typeof value==='string'?value.trim():'';return s.length>max?s.slice(0,max-1)+'…':s;}
