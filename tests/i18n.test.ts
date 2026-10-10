import test from "node:test";
import assert from "node:assert/strict";
import { LOCALES, resolveLocale } from "../src/lib/i18n/config";
import { dictionaries, translator } from "../src/lib/i18n/messages";
import { formatCurrency, formatNumber, formatPercent, formatDate } from "../src/lib/i18n/format";
import { buildMarketContext, validTimezone } from "../src/lib/i18n/market";
import { buildSeedRequest } from "../src/lib/openai/request";
import type { CompanyFact } from "../src/lib/memory/contracts";
const fact = (key: CompanyFact["key"], value: string): CompanyFact => ({ id: key, company_id: "a", key, value, version: 1, confirmed_by: null, created_at: "", updated_at: "" });
test("quatro catálogos completos, fallback e troca de locale sem alterar dados", () => {
  for (const locale of LOCALES) {
    assert.equal(resolveLocale(locale), locale);
    assert.deepEqual(Object.keys(dictionaries[locale]).sort(), Object.keys(dictionaries["pt-BR"]).sort());
    assert.ok(Object.values(dictionaries[locale]).every(value => value.length > 0));
  }
  assert.equal(resolveLocale("en"), "pt-BR");
  assert.equal(resolveLocale(undefined), "pt-BR");
  assert.equal(translator("en-US")("common.save"), "Save");
  assert.equal(translator("pt-PT")("common.save"), "Guardar");
  assert.equal(translator("es-ES")("common.save"), "Guardar");
  assert.equal(translator("pt-BR")("common.save"), "Salvar");
});
test("Intl formata moedas, números e percentuais sem mudar valores", () => {
  const clean = (s: string) => s.replace(/\s/g, " ");
  assert.equal(clean(formatCurrency(1234.5, "BRL", "pt-BR")), "R$ 1.234,50");
  assert.equal(clean(formatCurrency(1234.5, "EUR", "pt-PT")), "1234,50 €");
  assert.equal(formatCurrency(1234.5, "USD", "en-US"), "$1,234.50");
  assert.equal(clean(formatCurrency(1234.5, "EUR", "es-ES")), "1234,50 €");
  assert.equal(formatNumber(1234.5, "en-US"), "1,234.5");
  assert.equal(formatNumber(1234.5, "pt-BR"), "1.234,5");
  assert.equal(formatPercent(0.125, "en-US"), "12.5%");
});
test("datas respeitam locale e timezone, sem deslocamento implícito da máquina", () => {
  assert.equal(formatDate("2026-09-26T00:30:00Z", "pt-BR"), "26/09/2026");
  assert.equal(formatDate("2026-09-26T00:30:00Z", "en-US"), "9/26/2026");
  assert.equal(formatDate("2026-09-26T00:30:00Z", "pt-PT"), "26/09/2026");
  assert.equal(formatDate("2026-09-26T00:30:00Z", "es-ES"), "26/9/2026");
  assert.equal(formatDate("2026-09-26T00:30:00Z", "en-US", "America/New_York"), "9/25/2026");
  assert.equal(validTimezone("Fake/City"), false);
});
test("usuário português pode gerir empresa americana, e idioma não inventa mercado", () => {
  const market = buildMarketContext("pt-PT", { locale: "en-US", preferred_language: "en-US", timezone: "America/New_York" }, [fact("country", "US"), fact("currency", "USD")]);
  assert.deepEqual(market, { user_language: "pt-PT", company_country: "US", company_currency: "USD", company_locale: "en-US", company_preferred_language: "en-US", company_timezone: "America/New_York" });
  const request = buildSeedRequest("model", [{ role: "user", content: "Quero vender mais" }], "[]", "SALES", market);
  assert.ok(JSON.stringify(request.input).includes('"user_language"') || JSON.stringify(request.input).includes('user_language'));
  assert.ok(JSON.stringify(request.input).includes("America/New_York"));
  const unknown = buildMarketContext("es-ES", { locale: null, preferred_language: null, timezone: null }, []);
  assert.equal(unknown.company_country, null); assert.equal(unknown.company_currency, null);
  assert.equal(unknown.user_language, "es-ES");
});
