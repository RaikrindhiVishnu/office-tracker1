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