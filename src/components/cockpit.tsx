'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useI18n} from '@/lib/i18n/provider';
import {readHome,openHomeItem,dismissHomeItem,homeEvent} from '@/app/cockpit/actions';
import {REFRESH_MS,type Item,type ResolvedAction,type ViewModel} from '@/lib/cockpit/domain';
import {CockpitView} from './cockpit-view';

export function Cockpit({companyId,active,revision,onOpen,onCompany}:{companyId:string;active:boolean;revision:number;onOpen:(action:ResolvedAction,item:Item)=>Promise<void>;onCompany:()=>void}){
 const {locale,t}=useI18n(),[model,setModel]=useState<ViewModel|null>(null),[error,setError]=useState(false),[changed,setChanged]=useState(false),[busy,setBusy]=useState(false),[pending,setPending]=useState(true);
 const generation=useRef(0),readBusy=useRef<number|null>(null),lastRead=useRef(0),actionBusy=useRef(false);
 const [loadedLocale,setLoadedLocale]=useState(locale);
 const refresh=useCallback(async(force=false)=>{
  if(!active||readBusy.current===generation.current||!force&&Date.now()-lastRead.current<REFRESH_MS)return;
  const ticket=generation.current;readBusy.current=ticket;
  try{const data=await readHome(companyId);if(ticket!==generation.current)return;setLoadedLocale(locale);setModel(data);setError(false);lastRead.current=Date.now();}
  catch{if(ticket===generation.current)setError(true);}
  finally{if(ticket===generation.current)setPending(false);if(readBusy.current===ticket)readBusy.current=null;}
 },[active,companyId,locale]);
 useEffect(()=>{
  const ticket=++generation.current;lastRead.current=0;
  // Let the composer paint before scheduling the secondary data read.
  const initial=window.setTimeout(()=>{if(active){void refresh(true);void homeEvent(companyId,'home_viewed').catch(()=>{});}},0);
  const focus=()=>{if(document.visibilityState==='visible')void refresh();};
  window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);
  const timer=window.setInterval(focus,REFRESH_MS);
  return()=>{generation.current=ticket+1;window.clearTimeout(initial);window.clearInterval(timer);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);};
 },[companyId,active,revision,locale,refresh]);
 async function open(item:Item,dismiss=false){
  if(actionBusy.current)return;actionBusy.current=true;setBusy(true);setChanged(false);
  try{if(dismiss)await dismissHomeItem(companyId,item.ref);else await onOpen(await openHomeItem(companyId,item.ref),item);await refresh(true);}
  catch{setChanged(true);await refresh(true);}
  finally{actionBusy.current=false;setBusy(false);}
 }
 if(!active)return null;
 // Never reuse another company or language's rendered data after a transition.
 const current=model?.companyId===companyId&&loadedLocale===locale?model:null;
 return <div className="cockpit" aria-busy={pending||!current&&!error}>
  {!current&&!error&&<p className="cockpit-loading" role="status">{t('cockpit.loading')}…</p>}
  {current&&<CockpitView model={current} locale={locale} busy={busy} onOpen={item=>void open(item)} onDismiss={item=>void open(item,true)} onCompany={onCompany}/>}
  {(error||current?.partial)&&<p className="cockpit-note" role="status">{t('cockpit.partial')} <button className="text-button" disabled={pending} onClick={()=>void refresh(true)}>{t('cockpit.retry')}</button></p>}
  {changed&&<p className="cockpit-note" role="alert">{t('cockpit.contextChanged')}</p>}
 </div>;
}
