import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

// Local development only. Never send credentials through process arguments or logs.
const envPath = new URL("../.env.local", import.meta.url);
const config = parseEnv(readFileSync(envPath, "utf8"));
if (!/^(sk|rk)_test_/.test(config.STRIPE_SECRET_KEY ?? "")) {
  throw new Error("Configure uma chave Stripe de teste em .env.local.");
}
const installed = fileURLToPath(new URL("../../.stripe-tools/node_modules/@stripe/cli-win32-x64/bin/stripe.exe", import.meta.url));
const executable = process.env.STRIPE_CLI_PATH || (existsSync(installed) ? installed : "stripe");
const events = "checkout.session.completed,checkout.session.async_payment_succeeded,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.paid,invoice.payment_failed";
const child = spawn(executable, ["listen", "--skip-update", "--events-from", "@self", "--events", events, "--forward-to", "http://127.0.0.1:3001/api/billing/webhook"], {
  env: { ...process.env, STRIPE_API_KEY: config.STRIPE_SECRET_KEY },
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
});
let ready = false;
const deadline = setTimeout(() => {
  if (!ready) { console.error("Não foi possível conectar o webhook local ao Stripe."); child.kill(); }
}, 45_000);
function observe(line) {
  const secret = line.match(/\bwhsec_[A-Za-z0-9]+\b/)?.[0];
  if (secret && !ready) {
    const current = readFileSync(envPath, "utf8");
    const replacement = `STRIPE_WEBHOOK_SECRET=${secret}`;
    const next = /^\s*STRIPE_WEBHOOK_SECRET\s*=/m.test(current)
      ? current.replace(/^[ \t]*STRIPE_WEBHOOK_SECRET[ \t]*=[^\r\n]*/gm, replacement)
      : current.trimEnd() + "\n" + replacement + "\n";
    writeFileSync(envPath, next);
    ready = true;
    clearTimeout(deadline);
    console.log("Webhook de teste conectado. Segredo salvo em .env.local sem exibição.");
    console.log("Mantenha este processo aberto durante os testes Stripe.");
  }
  const delivered = line.match(/\[(\d{3})\]\s+POST\s/);
  if (delivered) console.log(`Entrega de webhook: HTTP ${delivered[1]}`);
}
for (const stream of [child.stdout, child.stderr]) {
  createInterface({ input: stream }).on("line", line => {
    try { observe(line); } catch { console.error("Não foi possível salvar o segredo do webhook."); child.kill(); }
  });
}
child.on("error", () => { clearTimeout(deadline); console.error("Stripe CLI indisponível. Instale a ferramenta oficial ou configure STRIPE_CLI_PATH."); process.exitCode = 1; });
child.on("exit", code => { clearTimeout(deadline); process.exitCode = code ?? 1; });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill());
