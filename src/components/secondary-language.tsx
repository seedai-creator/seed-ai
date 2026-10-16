"use client";
import {usePathname} from "next/navigation";
import {LanguageSwitcher} from "./language-switcher";
export function SecondaryLanguage(){return usePathname()==="/"?null:<div className="secondary-language"><LanguageSwitcher/></div>;}
