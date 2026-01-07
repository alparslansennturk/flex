export type PermissionAction = "view" | "edit" | "approve" | "export";
export type PermissionDomain = "finance" | "schedule" | "users";
export type UserRole = "admin" | "trainer" | "finance_specialist" | "owner";

export type UserPermissions = Partial<
  Record<PermissionDomain, PermissionAction[]>
>;

export interface FlexUser {
  id: string;
  name: string;
  role: UserRole;
  permissions: UserPermissions;
}

// Senior Move: Deklaratif Helperlar
export const isOwner = (user: FlexUser): boolean => user.role === "owner";

export const hasPermission = (
  user: FlexUser,
  domain: PermissionDomain,
  action: PermissionAction
): boolean => {
  if (isOwner(user)) return true;
  return user.permissions?.[domain]?.includes(action) ?? false;
};