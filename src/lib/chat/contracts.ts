export type ChatMessage = { role: "user" | "assistant"; content: string };
export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_MESSAGES = 21;
export class ChatError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function parseMessages(body: unknown): ChatMessage[] {
  if (!body || typeof body !== "object" || !("messages" in body) || !Array.isArray(body.messages))
    throw new ChatError(400, "INVALID_INPUT", "Envie uma mensagem válida.");
  const messages = body.messages;
  if (!messages.length || messages.length > MAX_MESSAGES)
    throw new ChatError(400, "INVALID_INPUT", "Inicie uma nova conversa para continuar.");
  let total = 0;
  const result = messages.map((message: unknown, index: number): ChatMessage => {
    if (!message || typeof message !== "object" || !("role" in message) || !("content" in message) ||
      message.role !== (index % 2 === 0 ? "user" : "assistant") ||
      typeof message.content !== "string" || !message.content.trim() ||
      message.content.length > (message.role === "user" ? MAX_MESSAGE_LENGTH : 12000))
      throw new ChatError(400, "INVALID_INPUT", "Revise sua mensagem e tente novamente.");
    total += message.content.length;
    return { role: message.role as ChatMessage["role"], content: message.content.trim() };
  });
  if (result.at(-1)?.role !== "user" || total > 40000)
    throw new ChatError(400, "INVALID_INPUT", "Inicie uma nova conversa para continuar.");
  return result;
}
