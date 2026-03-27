/**
 * roleRouting.ts
 * Single source of truth for role → route mappings.
 */

export type UserRole =
  | "superadmin"
  | "admin"
  | "hr"
  | "finance"
  | "sales"
  | "it"
  | "operations"
  | "marketing"
  | "executive"
  | "employee";

export const ROLE_ROUTES: Record<UserRole, string> = {
  superadmin : "/superadmin",
  admin      : "/admin",
  hr         : "/hr",
  finance    : "/analytics/financial",
  sales      : "/analytics/sales",
  it         : "/it",
  operations : "/analytics/operations",
  marketing  : "/analytics/marketing",
  executive  : "/analytics/executive",
  employee   : "/employee",
};

export const ROUTE_ROLES: Record<string, UserRole[]> = {
  "/superadmin"           : ["superadmin"],
  "/admin"                : ["superadmin", "admin"],
  "/hr"                   : ["superadmin", "admin", "hr"],
  "/it"                   : ["superadmin", "admin", "it"],
  "/employee"             : ["superadmin", "admin", "employee"],
  "/analytics/financial"  : ["superadmin", "admin", "finance", "executive"],
  "/analytics/sales"      : ["superadmin", "admin", "sales", "executive"],
  "/analytics/operations" : ["superadmin", "admin", "operations", "executive"],
  "/analytics/marketing"  : ["superadmin", "admin", "marketing", "executive"],
  "/analytics/executive"  : ["superadmin", "executive"],
};

export function getRoleRedirect(role: UserRole | null | undefined): string {
  if (!role) return "/login";
  return ROLE_ROUTES[role] ?? "/login";
}

export function isRoleAuthorized(
  role: UserRole | null | undefined,
  pathname: string,
): boolean {
  if (!role) return false;
  const matchedKey = Object.keys(ROUTE_ROLES)
    .filter((prefix) => pathname.startsWith(prefix))
    .sort((a, b) => b.length - a.length)[0];
  if (!matchedKey) return false;
  return (ROUTE_ROLES[matchedKey] as string[]).includes(role);
}