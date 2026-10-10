import test from "node:test";
import assert from "node:assert/strict";
import { authorizeCompany } from "../src/lib/auth/authorization";
import { createChatHandler } from "../src/lib/chat/handler";
import { ChatError } from "../src/lib/chat/contracts";
const companyId = "11111111-1111-4111-8111-111111111111";
test("usuário anônimo não consulta vínculos", async () => {
  let calls = 0;
  await assert.rejects(authorizeCompany(null, companyId, async () => { calls++; return true; }), (e: unknown) => e instanceof ChatError && e.status === 401);
  assert.equal(calls, 0);
});
test("empresa de outro usuário e identificador inválido são rejeitados", async () => {
  await assert.rejects(authorizeCompany("alice", companyId, async () => false), (e: unknown) => e instanceof ChatError && e.status === 403);
  await assert.rejects(authorizeCompany("alice", "invalid", async () => true), (e: unknown) => e instanceof ChatError && e.status === 400);
  assert.deepEqual(await authorizeCompany("alice", companyId, async (user, company) => user === "alice" && company === companyId), { userId: "alice", companyId });
});
test("autorização negada impede chamada paga à IA", async () => {
  for (const status of [401, 403, 409, 503]) {
    let calls = 0;
    const handler = createChatHandler(async () => { calls++; return { answer: "Não deve executar" }; }, async () => { throw new ChatError(status, "ACCESS_DENIED", "Acesso indisponível."); });
    const result = await handler(new Request("http://localhost/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ companyId, messages: [{ role: "user", content: "Vender mais" }] }) }));
    assert.equal(result.status, status);
    assert.equal(calls, 0);
  }
});
