import type {Locale} from "@/lib/i18n/config";
// Inline flags render consistently on Windows, where regional emoji can show letters.
export function RegionFlag({locale}:{locale:Locale}){
 return <svg aria-hidden="true" width="26" height="18" viewBox="0 0 30 20" className="region-flag">
 {locale==="pt-BR"?<><path fill="#168342" d="M0 0h30v20H0z"/><path fill="#ffda35" d="m15 2 12 8-12 8L3 10z"/><circle cx="15" cy="10" r="4.8" fill="#154e97"/><path d="M10.5 8.7q5-1 9 3" stroke="white" fill="none" strokeWidth="1"/></>:locale==="pt-PT"?<><path fill="#e52f35" d="M0 0h30v20H0z"/><path fill="#167c40" d="M0 0h12v20H0z"/><circle cx="12" cy="10" r="4" fill="#f1ce37"/><path fill="white" d="M10 7h4v5l-2 2-2-2z"/><path fill="#db3440" d="M11 8h2v4h-2z"/></>:locale==="es-ES"?<><path fill="#bd2538" d="M0 0h30v20H0z"/><path fill="#ffcf39" d="M0 5h30v10H0z"/><path fill="#bd2538" d="M8 7h4v5l-2 2-2-2z"/></>:<><path fill="white" d="M0 0h30v20H0z"/>{Array.from({length:7},(_,i)=><path key={i} fill="#bb3344" d={`M0 ${i*3}h30v1.5H0z`}/>)}<path fill="#254777" d="M0 0h13v11H0z"/>{Array.from({length:12},(_,i)=><circle key={i} fill="white" cx={2+(i%4)*3} cy={2+Math.floor(i/4)*3} r=".6"/>)}</>}
 </svg>;
}
