export const WORKSPACE_PERMISSIONS = [
  "workspace_admin",
  "hiring_access",
  "hiring_reviewer",
  "program_supervisor",
] as const;
export type WorkspacePermission = (typeof WORKSPACE_PERMISSIONS)[number];
export const PERMISSION_LABELS: Record<WorkspacePermission, string> = {
  workspace_admin: "Workspace Admin",
  hiring_access: "Hiring Access",
  hiring_reviewer: "Hiring Reviewer / Hiring Manager",
  program_supervisor: "Program Supervisor",
};
type MembershipAccess = { role: string; permissions: string[] | null };
export function permissionsFor(
  member: MembershipAccess,
): WorkspacePermission[] {
  if (member.role === "owner") return [...WORKSPACE_PERMISSIONS];
  if (member.permissions !== null)
    return WORKSPACE_PERMISSIONS.filter((p) => member.permissions!.includes(p));
  // Preserve legacy access until an administrator explicitly configures it.
  return member.role === "admin"
    ? [...WORKSPACE_PERMISSIONS]
    : ["hiring_access", "program_supervisor"];
}
export function hasPermission(
  member: MembershipAccess,
  permission: WorkspacePermission,
) {
  const granted = permissionsFor(member);
  return (
    granted.includes("workspace_admin") ||
    granted.includes(permission) ||
    (permission === "hiring_reviewer" && granted.includes("hiring_access"))
  );
}

/** Legacy members could draft, but not approve/publish/close. An explicit grant opts into the new access model. */
export function canManagePublication(member: MembershipAccess) {
  if (member.permissions === null && member.role === "member") return false;
  return hasPermission(member, "hiring_access");
}
