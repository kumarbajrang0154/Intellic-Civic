/**
 * staffService.ts — Business logic for Staff & User Management
 * All route handlers call this service; no direct store access from routes.
 */

import { addAuditLog, listAuditLogs } from '@/lib/audit-store';
import {
  addUser,
  deleteUser,
  getDepartment,
  getUser,
  getUserByEmail,
  listDepartments,
  listUsers,
  suspendUser,
  updateUser,
  type UserItem,
} from '@/lib/staff-dept-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StaffRole = 'DEPARTMENT_HEAD' | 'DEPARTMENT_OFFICER' | 'FIELD_WORKER' | 'ADMIN';
export const STAFF_ROLES: StaffRole[] = ['DEPARTMENT_HEAD', 'DEPARTMENT_OFFICER', 'FIELD_WORKER', 'ADMIN'];
const ROLES_REQUIRING_DEPARTMENT: StaffRole[] = ['DEPARTMENT_HEAD', 'DEPARTMENT_OFFICER', 'FIELD_WORKER'];

export interface StaffListFilters {
  search?: string;
  role?: string;
  departmentId?: string;
  status?: 'active' | 'inactive' | 'all';
  page?: number;
  limit?: number;
}

export interface StaffListResult {
  items: StaffSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface StaffSummary {
  id: string;
  name: string;
  email: string;
  role: string | null;
  departmentId: string | null;
  departmentName: string | null;
  isActive: boolean;
  isAuthorized: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface CreateStaffInput {
  name: string;
  email: string;
  role: StaffRole;
  departmentId?: string | null;
}

export interface ReassignInput {
  newRole?: StaffRole;
  newDepartmentId?: string | null;
}

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function userToSummary(u: UserItem): Promise<StaffSummary> {
  const dept = u.departmentId ? await getDepartment(u.departmentId) : undefined;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    departmentId: u.departmentId,
    departmentName: dept?.name ?? null,
    isActive: !u.isSuspended,
    isAuthorized: u.isAuthorized,
    lastLoginAt: u.lastLoginAt ?? null,
    createdAt: u.createdAt,
  };
}

function requiresDepartment(role: StaffRole): boolean {
  return ROLES_REQUIRING_DEPARTMENT.includes(role);
}

// ---------------------------------------------------------------------------
// List Staff
// ---------------------------------------------------------------------------

export async function listStaff(filters: StaffListFilters): Promise<ServiceResult<StaffListResult>> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

  let fetchedUsers = await listUsers({
    role: filters.role && filters.role !== 'ALL' ? filters.role : undefined,
    departmentId: filters.departmentId && filters.departmentId !== 'ALL' ? filters.departmentId : undefined,
    search: filters.search,
  });

  let allUsers = fetchedUsers.filter((u) => u.role !== 'CITIZEN' && u.role !== null);

  if (filters.status === 'active') {
    allUsers = allUsers.filter((u) => !u.isSuspended);
  } else if (filters.status === 'inactive') {
    allUsers = allUsers.filter((u) => u.isSuspended);
  }

  const total = allUsers.length;
  const offset = (page - 1) * limit;
  const pageItems = allUsers.slice(offset, offset + limit);
  const items = await Promise.all(pageItems.map(userToSummary));

  return {
    ok: true,
    data: {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

// ---------------------------------------------------------------------------
// Get single staff member
// ---------------------------------------------------------------------------

export async function getStaffMember(id: string): Promise<ServiceResult<StaffSummary>> {
  const user = await getUser(id);
  if (!user || user.role === 'CITIZEN') {
    return { ok: false, status: 404, message: 'Staff member not found.' };
  }
  return { ok: true, data: await userToSummary(user) };
}

// ---------------------------------------------------------------------------
// Create Staff
// ---------------------------------------------------------------------------

export async function createStaff(
  input: CreateStaffInput,
  actor: { id: string; name: string },
): Promise<ServiceResult<StaffSummary>> {
  if (!STAFF_ROLES.includes(input.role)) {
    return { ok: false, status: 400, message: `Invalid role: ${input.role}. Must be one of ${STAFF_ROLES.join(', ')}.` };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!input.email || !emailRegex.test(input.email.trim())) {
    return { ok: false, status: 400, message: 'A valid email address is required.' };
  }

  if (!input.name || input.name.trim().length < 2) {
    return { ok: false, status: 400, message: 'Name must be at least 2 characters.' };
  }

  const existing = await getUserByEmail(input.email.trim());
  if (existing) {
    return { ok: false, status: 409, message: `A user with email ${input.email} already exists.` };
  }

  if (requiresDepartment(input.role)) {
    if (!input.departmentId) {
      return { ok: false, status: 400, message: `Role ${input.role} requires a department assignment.` };
    }
    const dept = await getDepartment(input.departmentId);
    if (!dept) {
      return { ok: false, status: 400, message: 'Selected department does not exist.' };
    }
    if (dept.isSuspended) {
      return { ok: false, status: 400, message: 'Cannot assign staff to a suspended department.' };
    }
  }

  const created = await addUser({
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role,
    departmentId: requiresDepartment(input.role) ? (input.departmentId ?? null) : null,
    isAuthorized: true,
  });

  await addAuditLog({
    actorId: actor.id,
    actorName: actor.name,
    action: 'STAFF_CREATED',
    entityType: 'User',
    targetId: created.id,
    targetName: created.name,
    metadata: { email: created.email, role: created.role, departmentId: created.departmentId },
  });

  return { ok: true, data: await userToSummary(created) };
}

// ---------------------------------------------------------------------------
// Deactivate Staff
// ---------------------------------------------------------------------------

export async function deactivateStaff(
  targetId: string,
  actor: { id: string; name: string },
): Promise<ServiceResult<StaffSummary>> {
  if (targetId === actor.id) {
    return { ok: false, status: 400, message: 'You cannot deactivate your own account.' };
  }

  const user = await getUser(targetId);
  if (!user || user.role === 'CITIZEN') {
    return { ok: false, status: 404, message: 'Staff member not found.' };
  }

  if (user.isSuspended) {
    return { ok: false, status: 400, message: 'Staff member is already inactive.' };
  }

  const updated = await suspendUser(targetId, true);
  if (!updated) {
    return { ok: false, status: 500, message: 'Failed to deactivate staff member.' };
  }

  await addAuditLog({
    actorId: actor.id,
    actorName: actor.name,
    action: 'STAFF_DEACTIVATED',
    entityType: 'User',
    targetId: updated.id,
    targetName: updated.name,
    metadata: { email: updated.email, role: updated.role },
  });

  return { ok: true, data: await userToSummary(updated) };
}

// ---------------------------------------------------------------------------
// Reactivate Staff
// ---------------------------------------------------------------------------

export async function reactivateStaff(
  targetId: string,
  actor: { id: string; name: string },
): Promise<ServiceResult<StaffSummary>> {
  const user = await getUser(targetId);
  if (!user || user.role === 'CITIZEN') {
    return { ok: false, status: 404, message: 'Staff member not found.' };
  }

  if (!user.isSuspended) {
    return { ok: false, status: 400, message: 'Staff member is already active.' };
  }

  const updated = await suspendUser(targetId, false);
  if (!updated) {
    return { ok: false, status: 500, message: 'Failed to reactivate staff member.' };
  }

  await addAuditLog({
    actorId: actor.id,
    actorName: actor.name,
    action: 'STAFF_REACTIVATED',
    entityType: 'User',
    targetId: updated.id,
    targetName: updated.name,
    metadata: { email: updated.email, role: updated.role },
  });

  return { ok: true, data: await userToSummary(updated) };
}

// ---------------------------------------------------------------------------
// Reassign Staff
// ---------------------------------------------------------------------------

export async function reassignStaff(
  targetId: string,
  input: ReassignInput,
  actor: { id: string; name: string },
): Promise<ServiceResult<StaffSummary>> {
  const user = await getUser(targetId);
  if (!user || user.role === 'CITIZEN') {
    return { ok: false, status: 404, message: 'Staff member not found.' };
  }

  const newRole = (input.newRole ?? user.role) as StaffRole;
  const newDepartmentId = input.newDepartmentId !== undefined ? input.newDepartmentId : user.departmentId;

  if (!STAFF_ROLES.includes(newRole)) {
    return { ok: false, status: 400, message: `Invalid role: ${newRole}.` };
  }

  if (requiresDepartment(newRole)) {
    if (!newDepartmentId) {
      return { ok: false, status: 400, message: `Role ${newRole} requires a department assignment.` };
    }
    const dept = await getDepartment(newDepartmentId);
    if (!dept) {
      return { ok: false, status: 400, message: 'Target department does not exist.' };
    }
    if (dept.isSuspended) {
      return { ok: false, status: 400, message: 'Cannot reassign to a suspended department.' };
    }
  }

  const oldRole = user.role;
  const oldDepartmentId = user.departmentId;

  const updated = await updateUser(targetId, {
    role: newRole,
    departmentId: requiresDepartment(newRole) ? newDepartmentId : null,
  });

  if (!updated) {
    return { ok: false, status: 500, message: 'Failed to reassign staff member.' };
  }

  await addAuditLog({
    actorId: actor.id,
    actorName: actor.name,
    action: 'STAFF_REASSIGNED',
    entityType: 'User',
    targetId: updated.id,
    targetName: updated.name,
    metadata: { oldRole, newRole, oldDepartmentId, newDepartmentId },
  });

  return { ok: true, data: await userToSummary(updated) };
}

// ---------------------------------------------------------------------------
// Delete Staff
// ---------------------------------------------------------------------------

export async function removeStaff(
  targetId: string,
  actor: { id: string; name: string },
): Promise<ServiceResult<{ deleted: boolean }>> {
  if (targetId === actor.id) {
    return { ok: false, status: 400, message: 'You cannot delete your own account.' };
  }

  const user = await getUser(targetId);
  if (!user) {
    return { ok: false, status: 404, message: 'Staff member not found.' };
  }

  const deleted = await deleteUser(targetId);
  if (!deleted) {
    return { ok: false, status: 403, message: 'Cannot delete this account (Super Admin is protected).' };
  }

  await addAuditLog({
    actorId: actor.id,
    actorName: actor.name,
    action: 'STAFF_DELETED',
    entityType: 'User',
    targetId,
    targetName: user.name,
    metadata: { email: user.email, role: user.role },
  });

  return { ok: true, data: { deleted: true } };
}

// ---------------------------------------------------------------------------
// Activity Log for a specific staff member
// ---------------------------------------------------------------------------

export interface ActivityEntry {
  id: string;
  action: string;
  actorId: string;
  actorName: string;
  targetId: string | null;
  targetName: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
}

export async function getStaffActivity(
  targetId: string,
  limit = 50,
): Promise<ServiceResult<ActivityEntry[]>> {
  const user = await getUser(targetId);
  if (!user) {
    return { ok: false, status: 404, message: 'Staff member not found.' };
  }

  const asTarget = await listAuditLogs({ targetId, limit });
  const asActor = await listAuditLogs({ actorId: targetId, limit });

  const seen = new Set<string>();
  const combined: ActivityEntry[] = [];

  for (const e of [...asTarget, ...asActor]) {
    if (!seen.has(e.id)) {
      seen.add(e.id);
      combined.push({
        id: e.id,
        action: e.action,
        actorId: e.actorId,
        actorName: e.actorName,
        targetId: e.targetId,
        targetName: e.targetName,
        metadata: e.metadata,
        createdAt: e.createdAt,
      });
    }
  }

  combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return { ok: true, data: combined.slice(0, limit) };
}

// ---------------------------------------------------------------------------
// Workload Summary (department-wise staff counts)
// ---------------------------------------------------------------------------

export interface DeptWorkload {
  departmentId: string;
  departmentName: string;
  heads: number;
  officers: number;
  fieldWorkers: number;
  totalStaff: number;
  inactiveStaff: number;
}

export async function getWorkloadSummary(): Promise<ServiceResult<DeptWorkload[]>> {
  const departments = await listDepartments();
  const allUsers = await listUsers();
  const allStaff = allUsers.filter((u) => u.role !== 'CITIZEN' && u.role !== null);

  const summary: DeptWorkload[] = departments.map((dept) => {
    const deptStaff = allStaff.filter((u) => u.departmentId === dept.id);
    return {
      departmentId: dept.id,
      departmentName: dept.name,
      heads: deptStaff.filter((u) => u.role === 'DEPARTMENT_HEAD').length,
      officers: deptStaff.filter((u) => u.role === 'DEPARTMENT_OFFICER').length,
      fieldWorkers: deptStaff.filter((u) => u.role === 'FIELD_WORKER').length,
      totalStaff: deptStaff.length,
      inactiveStaff: deptStaff.filter((u) => u.isSuspended).length,
    };
  });

  return { ok: true, data: summary };
}
