import { ChatError } from "./contracts";
import {boundedBody,trustedOrigin} from '../operations/http';
import {logEvent,requestId} from '../operations/logging';
type Orchestrator = (body: unknown, signal?: AbortSignal) => Promise<{ answer: string }>;
const MAX_BODY_BYTES = 160000;
function json(body: unknown, status = 200, id?:string) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store",...(id?{'X-Request-Id':id}:{}) } });
}
async function readBody(request: Request) {
  const text=await boundedBody(request,MAX_BODY_BYTES);
  try { return JSON.parse(text) as unknown; }
  catch { throw new ChatError(400, "INVALID_JSON", "Envie uma mensagem válida."); }
}
export function createChatHandler(orchestrate: Orchestrator, authorize: (body: unknown) => Promise<void>) {
  return async (request: Request) => {
    const id=requestId(),started=Date.now();
    try {
      if (!trustedOrigin(request,process.env.NEXT_PUBLIC_SITE_URL))
        throw new ChatError(403, "INVALID_ORIGIN", "Solicitação não autorizada.");
      if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
        throw new ChatError(415, "INVALID_CONTENT_TYPE", "Envie uma mensagem válida.");
      const body = await readBody(request);
      await authorize(body);
      const answer=await orchestrate(body, AbortSignal.any([request.signal,AbortSignal.timeout(110000)]));
      logEvent('chat.completed',{requestId:id,durationMs:Date.now()-started,statusCode:200});
      return json(answer,200,id);
    } catch (error) {
      if (error instanceof ChatError) {
        logEvent('chat.failed',{requestId:id,code:error.code,statusCode:error.status,durationMs:Date.now()-started},error.status>=500?'error':'warn');
        return json({ error: error.message, code: error.code }, error.status,id);
      }
      logEvent('chat.failed',{requestId:id,code:'UNEXPECTED_ERROR',statusCode:500,durationMs:Date.now()-started},'error');
      return json({ error: "Algo deu errado. Tente novamente.", code: "UNEXPECTED_ERROR" }, 500,id);
    }
  };
}
