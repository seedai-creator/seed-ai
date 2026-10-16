import { ChatError } from "./contracts";
type Orchestrator = (body: unknown, signal?: AbortSignal) => Promise<{ answer: string }>;
const MAX_BODY_BYTES = 160000;
function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
async function readBody(request: Request) {
  if (!request.body) throw new ChatError(400, "INVALID_JSON", "Envie uma mensagem válida.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new ChatError(413, "TOO_LARGE", "A conversa é muito longa. Inicie uma nova conversa.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)) as unknown; }
  catch { throw new ChatError(400, "INVALID_JSON", "Envie uma mensagem válida."); }
}
export function createChatHandler(orchestrate: Orchestrator, authorize: (body: unknown) => Promise<void>) {
  return async (request: Request) => {
    try {
      const origin = request.headers.get("origin");
      const expectedOrigin = new URL(request.url);
      expectedOrigin.host = request.headers.get("host") ?? expectedOrigin.host;
      if (origin && origin !== expectedOrigin.origin)
        throw new ChatError(403, "INVALID_ORIGIN", "Solicitação não autorizada.");
      if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
        throw new ChatError(415, "INVALID_CONTENT_TYPE", "Envie uma mensagem válida.");
      const body = await readBody(request);
      await authorize(body);
      return json(await orchestrate(body, request.signal));
    } catch (error) {
      if (error instanceof ChatError) {
        if (error.status >= 500) console.error("[seed:chat]", { code: error.code, status: error.status });
        return json({ error: error.message, code: error.code }, error.status);
      }
      console.error("[seed:chat]", { code: "UNEXPECTED_ERROR" });
      return json({ error: "Algo deu errado. Tente novamente.", code: "UNEXPECTED_ERROR" }, 500);
    }
  };
}
