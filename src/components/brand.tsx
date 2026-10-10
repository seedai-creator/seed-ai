"use client";
import { useI18n } from "@/lib/i18n/provider";
import Image from "next/image";
import Link from "next/link";
export function Brand({onHome}:{onHome?:()=>void}={}) {
  const { t } = useI18n();

  return <Link href="/" className="brand" aria-label={t("brand.home")} onClick={onHome?event=>{event.preventDefault();onHome();}:undefined}><span className="brand-logo"><Image src="/seed-ai-logo.png" alt="SeedAI" width={2000} height={2000} priority /></span></Link>;
}

