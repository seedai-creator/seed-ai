"use client";
import {useState,useTransition,useRef} from "react";
import {useI18n} from "@/lib/i18n/provider";
import {LOCALES,LOCALE_NAMES} from "@/lib/i18n/config";
import {RegionFlag} from "./region-flag";
import {changeLocale} from "@/app/preferences/actions";

export function LanguageSwitcher(){const {t,locale}=useI18n();const[pending,start]=useTransition(),[error,setError]=useState("");const details=useRef<HTMLDetailsElement>(null);return <details className="core-language" ref={details}><summary aria-label={t("core.region")+": "+LOCALE_NAMES[locale]} title={t("core.region")+": "+LOCALE_NAMES[locale]}>{<RegionFlag locale={locale}/>}</summary><div><strong>{t("core.region")}</strong>{LOCALES.map(value=><button key={value} type="button" disabled={pending} aria-current={value===locale?"true":undefined} onClick={()=>start(async()=>{try{const result=await changeLocale(value);setError(result.error??"");if(!result.error&&details.current)details.current.open=false;}catch{setError(t("settings.error"));}})}>{<RegionFlag locale={value}/>} {LOCALE_NAMES[value]}</button>)}{error&&<p role="alert">{error}</p>}</div></details>}
