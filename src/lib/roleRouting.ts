export type UserRole =
  | "superadmin"
  | "admin"
  | "hr"
  | "employee";

export function getRoleRedirect(
  role: string | null | undefined,
  department?: string | null
): string {
  if (!role) return "/login";

  const r = role.toLowerCase();
  const d = (department || "").toLowerCase();

  // ✅ ADMIN ROUTES
  if (r === "superadmin") return "/superadmin";
  if (r === "admin") return "/admin";
  if (r === "hr") return "/hr";

  // ✅ EMPLOYEE → DEPARTMENT BASED 
  if (r === "employee") {
    switch (d) {
      case "sales":
        return "/analytics/sales";

      case "finance":
        return "/analytics/financial";

      case "marketing":
        return "/analytics/marketing";

      case "operations":
        return "/analytics/operations";

      case "executive":
        return "/analytics/executive";

      case "customersupport":
      case "customer_support":
        return "/analytics/customersupport";

      default:
        return "/employee";
    }
  }

  return "/login";
}

export function isRoleAuthorized(
  userRole: string | null | undefined,
  allowedRoles: string[]
): boolean {
  if (!userRole) return false;
  return allowedRoles.includes(userRole.toLowerCase());
}

export function getMobileRedirect(clickAction?: string): string | undefined {
  if (!clickAction) return undefined;
  
  if (typeof window !== "undefined") {
    const isMobile = window.innerWidth < 768 || /Mobi|Android|iPhone/i.test(navigator.userAgent);
    if (isMobile) {
      const lower = clickAction.toLowerCase();
      let tab = "home";
      if (lower.includes("attendance")) tab = "attendance";
      else if (lower.includes("task") || lower.includes("project")) tab = "projects";
      else if (lower.includes("standup")) tab = "standup";
      else if (lower.includes("meeting") || lower.includes("meet") || lower.includes("message") || lower.includes("chat")) tab = "chat";
      else if (lower.includes("approval")) tab = "approvals";
      else if (lower.includes("emergency") || lower.includes("alert")) tab = "emergency";
      else if (lower.includes("payslip")) tab = "payslips";
      else if (lower.includes("profile")) tab = "profile";
      else if (lower.includes("leave")) tab = "leave";
      else if (lower.includes("help")) tab = "help";
      
      return `/mobile?tab=${tab}`;
    }
  }
  return clickAction;
}