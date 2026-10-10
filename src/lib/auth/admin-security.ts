export const ADMIN_LEVELS=['ADMIN_VIEWER','ADMIN_OPERATOR','SUPER_ADMIN'] as const;
export type AdminRole=typeof ADMIN_LEVELS[number];
export function permittedAdminRole(role:unknown,minimum:AdminRole):role is AdminRole {
 return typeof role==='string'&&ADMIN_LEVELS.includes(role as AdminRole)&&ADMIN_LEVELS.indexOf(role as AdminRole)>=ADMIN_LEVELS.indexOf(minimum);
}
export function adminMfaSatisfied(claims:Record<string,unknown>|undefined) {
 return claims?.aal==='aal2';
}
