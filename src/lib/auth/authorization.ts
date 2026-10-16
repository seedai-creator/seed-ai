import { ChatError } from "../chat/contracts";
import { validId } from "./validation";
export async function authorizeCompany(
  userId: string | null, companyId: unknown,
  isMember: (userId: string, companyId: string) => Promise<boolean>,
) {
  if (!userId) throw new ChatError(401, "UNAUTHENTICATED", "Entre na sua conta para continuar.");
  if (!validId(companyId)) throw new ChatError(400, "INVALID_COMPANY", "Selecione uma empresa válida.");
  if (!await isMember(userId, companyId)) throw new ChatError(403, "FORBIDDEN", "Você não tem acesso a esta empresa.");
  return { userId, companyId };
}
