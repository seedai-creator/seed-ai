import type {Locale} from '../lib/i18n/config';
import type {Item,ViewModel} from '../lib/cockpit/domain';
import {cockpitText,dateText} from '../lib/cockpit/format';

export function CockpitView({model,locale,busy=false,onOpen,onDismiss,onCompany}:{model:ViewModel;locale:Locale;busy?:boolean;onOpen:(item:Item)=>void;onDismiss:(item:Item)=>void;onCompany:()=>void}){
 const l=cockpitText(locale);
 if(!model.items.length)return model.states.includes('LOW_CONTEXT')?<p className="cockpit-empty">{l('lowContext')} <button className="text-button" onClick={onCompany}>{l('update')} →</button></p>:null;
 return <section className="cockpit-section" aria-labelledby="cockpit-title" aria-busy={busy}>
  <h2 id="cockpit-title" className="sr-only">{l('section')}</h2>
  <div className="cockpit-items">{model.items.slice(0,3).map((item,index)=><article className={'cockpit-item'+(index===0?' cockpit-focus':'')} key={item.ref.type+item.ref.id}>
   <p className="cockpit-eyebrow">{item.eyebrow}</p>
   <h3>{item.title}</h3><p className="cockpit-summary">{item.summary}</p>
   {!!item.facts.length&&<dl className="cockpit-facts">{item.facts.map((fact,i)=><div key={i}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>}
   {item.progress!==null&&<progress className="cockpit-progress" max={100} value={item.progress} aria-label={item.eyebrow+' — '+item.title}>{item.progress}%</progress>}
   {item.progressLabel&&<p className="cockpit-detail">{item.progressLabel}</p>}
   {item.note&&<p className="cockpit-note">{item.note}</p>}
   {!!item.links?.length&&<ul className="cockpit-sources">{item.links.map(link=><li key={link.url}><a href={link.url} target="_blank" rel="noopener noreferrer">{link.title}</a>{link.at&&Number.isFinite(Date.parse(link.at))?' · '+dateText(link.at,locale):''}</li>)}</ul>}
   <p className="cockpit-date">{l('asOf')} <time dateTime={item.updatedAt}>{dateText(item.updatedAt,locale)}</time></p>
   <div className="cockpit-controls"><button className="cockpit-cta" disabled={busy} onClick={()=>onOpen(item)}>{item.cta} <span aria-hidden="true">↗</span></button>{item.dismissible&&<button className="text-button cockpit-dismiss" disabled={busy} onClick={()=>onDismiss(item)}>{l('dismiss')}</button>}</div>
  </article>)}</div>
 </section>;
}
