import br from "./locales/pt-BR.json";
import pt from "./locales/pt-PT.json";
import en from "./locales/en-US.json";
import es from "./locales/es-ES.json";
import type { Locale } from "./config";
export type MessageKey = keyof typeof br;
export const dictionaries: Record<Locale, Record<MessageKey, string>> = { "pt-BR": br, "pt-PT": pt, "en-US": en, "es-ES": es };
export function translator(locale: Locale) {
  return (key: MessageKey, params: Record<string, string | number> = {}) =>
    Object.entries(params).reduce((text, [name, value]) => text.replaceAll("{" + name + "}", String(value)), dictionaries[locale][key] ?? br[key]);
}
// Compatibility for existing server error messages; never call this on AI/user content.
export function translateMessage(locale: Locale, message: string) {
  const key = (Object.keys(br) as MessageKey[]).find(key => br[key] === message);
  return key ? translator(locale)(key) : message;
}
