import { authorizeChat } from "@/lib/auth/context";
import { createChatHandler } from "@/lib/chat/handler";
import { orchestrate } from "@/lib/seed/orchestrator";
export const runtime = "nodejs";
export const maxDuration = 120;
export const POST = createChatHandler(orchestrate, authorizeChat);
