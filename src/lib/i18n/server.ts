import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, resolveLocale } from "./config";
import { translator } from "./messages";
export async function getLocale() { return resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value); }
export async function getTranslator() { return translator(await getLocale()); }
