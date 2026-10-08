import prisma from '@/lib/prisma';
import { UserRole, AuthProvider, Prisma } from '@prisma/client';

export interface DepartmentItem {
  id: string;
  name: string;
  description: string;
  headOfficeAddress: string;
  isSuspended: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserItem {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'SUPER_ADMIN' | 'DEPARTMENT_HEAD' | 'DEPARTMENT_OFFICER' | 'FIELD_WORKER' | 'CITIZEN' | null;
  departmentId: string | null;
  municipalityId: string | null;
  assignedOfficerId: string | null;
  isAuthorized: boolean;
  isSuspended: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function getSuperAdminEmail(): string {
  return (process.env.SUPER_ADMIN_BOOTSTRAP_EMAIL || 'kumarbajrang325@gmail.com').trim().toLowerCase();
}

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === getSuperAdminEmail();
}

export function isSuperAdminTarget(target?: { role?: string | null; email?: string | null } | null): boolean {
  if (!target) return false;
  return target.role === 'SUPER_ADMIN' || (target.email ? isSuperAdminEmail(target.email) : false);
}

export async function getDefaultMunicipality() {
  let municipality = await prisma.municipality.findFirst({
    where: { OR: [{ code: 'CBE-MUN' }, { name: 'Coimbatore Municipality' }] },
  });
  if (!municipality) {
    municipality = await prisma.municipality.create({
      data: {
        name: 'Coimbatore Municipality',
        code: 'CBE-MUN',
        city: 'Coimbatore',
        state: 'Tamil Nadu',
      },
    });
  }
  return municipality;
}

function formatDepartmentItem(dept: any): DepartmentItem {
  return {
    id: dept.id,
    name: dept.name,
    description: dept.description,
    headOfficeAddress: dept.headOfficeAddress || 'Civic Center Complex, Main City Sector',
    isSuspended: Boolean(dept.isSuspended),
    createdAt: dept.createdAt instanceof Date ? dept.createdAt.toISOString() : new Date(dept.createdAt || Date.now()).toISOString(),
    updatedAt: dept.updatedAt instanceof Date ? dept.updatedAt.toISOString() : new Date(dept.updatedAt || Date.now()).toISOString(),
  };
}

function formatUserItem(user: any): UserItem {
  return {
    id: user.id,
    name: user.name,
    email: user.email || '',
    role: (user.role as UserItem['role']) || null,
    departmentId: user.departmentId || null,
    municipalityId: user.municipalityId || null,
    assignedOfficerId: user.assignedOfficerId || null,
    isAuthorized: Boolean(user.isAuthorized),
    isSuspended: Boolean(user.isSuspended),
    lastLoginAt: user.lastLoginAt ? (user.lastLoginAt instanceof Date ? user.lastLoginAt.toISOString() : new Date(user.lastLoginAt).toISOString()) : null,
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : new Date(user.createdAt || Date.now()).toISOString(),
    updatedAt: user.updatedAt instanceof Date ? user.updatedAt.toISOString() : new Date(user.updatedAt || Date.now()).toISOString(),
  };
}

// -----------------------------------------------------------------------------
// Department Management Helpers
// -----------------------------------------------------------------------------

export async function listDepartments(): Promise<DepartmentItem[]> {
  const depts = await prisma.department.findMany({
    orderBy: { createdAt: 'asc' },
  });
  return depts.map(formatDepartmentItem);
}

export async function getDepartment(id: string): Promise<DepartmentItem | undefined> {
  const dept = await prisma.department.findUnique({ where: { id } });
  return dept ? formatDepartmentItem(dept) : undefined;
}

export async function addDepartment(input: {
  name: string;
  description: string;
  headOfficeAddress?: string;
}): Promise<DepartmentItem> {
  const dept = await prisma.department.create({
    data: {
      name: input.name.trim(),
      description: input.description.trim(),
      headOfficeAddress: input.headOfficeAddress?.trim() || 'Civic Center Complex, Main City Sector',
      isSuspended: false,
    },
  });
  return formatDepartmentItem(dept);
}

export async function updateDepartment(
  id: string,
  updates: Partial<Pick<DepartmentItem, 'name' | 'description' | 'headOfficeAddress' | 'isSuspended'>>,
): Promise<DepartmentItem | null> {
  try {
    const dept = await prisma.department.update({
      where: { id },
      data: {
        name: updates.name !== undefined ? updates.name.trim() : undefined,
        description: updates.description !== undefined ? updates.description.trim() : undefined,
        headOfficeAddress: updates.headOfficeAddress !== undefined ? updates.headOfficeAddress.trim() : undefined,
        isSuspended: updates.isSuspended !== undefined ? updates.isSuspended : undefined,
      },
    });
    return formatDepartmentItem(dept);
  } catch {
    return null;
  }
}

export async function suspendDepartment(id: string, isSuspended: boolean): Promise<DepartmentItem | null> {
  return updateDepartment(id, { isSuspended });
}

export async function deleteDepartment(id: string): Promise<boolean> {
  try {
    await prisma.user.updateMany({
      where: { departmentId: id },
      data: { departmentId: null },
    });

    await prisma.department.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------------
// User / Officer Management Helpers
// -----------------------------------------------------------------------------

export async function listUsers(filters?: {
  role?: string;
  departmentId?: string;
  assignedOfficerId?: string;
  pendingOnly?: boolean;
  search?: string;
}): Promise<UserItem[]> {
  const where: any = {};

  if (filters?.pendingOnly) {
    where.isAuthorized = false;
    where.role = { not: UserRole.ADMIN };
  }

  if (filters?.role && filters.role !== 'ALL') {
    where.role = filters.role as UserRole;
  }

  if (filters?.departmentId && filters.departmentId !== 'ALL') {
    where.departmentId = filters.departmentId;
  }

  if (filters?.assignedOfficerId) {
    where.assignedOfficerId = filters.assignedOfficerId;
  }

  if (filters?.search) {
    const q = filters.search.trim();
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return users.map(formatUserItem);
}

export async function getUser(id: string): Promise<UserItem | undefined> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? formatUserItem(user) : undefined;
}

export async function getUserByEmail(email: string): Promise<UserItem | undefined> {
  if (!email) return undefined;
  const user = await prisma.user.findFirst({
    where: { email: { equals: email.trim(), mode: 'insensitive' } },
  });
  return user ? formatUserItem(user) : undefined;
}

export async function ensureSuperAdminUser(
  email?: string,
  name: string = 'Bajrang Kumar (Super Admin)',
): Promise<UserItem> {
  const targetEmail = (email || getSuperAdminEmail()).toLowerCase().trim();

  let admin = await prisma.user.findFirst({
    where: {
      OR: [{ email: targetEmail }, { id: 'usr_super_admin' }],
    },
  });

  const mun = await getDefaultMunicipality();

  if (admin) {
    admin = await prisma.user.update({
      where: { id: admin.id },
      data: {
        email: targetEmail,
        role: UserRole.SUPER_ADMIN,
        isAuthorized: true,
        isSuspended: false,
        name: admin.name || name,
        municipalityId: admin.municipalityId || mun.id,
      },
    });
  } else {
    admin = await prisma.user.create({
      data: {
        id: 'usr_super_admin',
        name,
        email: targetEmail,
        role: UserRole.SUPER_ADMIN,
        authProvider: AuthProvider.GOOGLE,
        departmentId: null,
        municipalityId: mun.id,
        isAuthorized: true,
        isSuspended: false,
      },
    });
  }

  return formatUserItem(admin);
}

export async function addUser(input: {
  name: string;
  email: string;
  role: UserItem['role'];
  departmentId?: string | null;
  assignedOfficerId?: string | null;
  municipalityId?: string | null;
  isAuthorized?: boolean;
}): Promise<UserItem> {
  const cleanEmail = input.email.trim().toLowerCase();
  const existing = await getUserByEmail(cleanEmail);

  let defaultMunId = input.municipalityId;
  if (!defaultMunId) {
    const mun = await getDefaultMunicipality();
    defaultMunId = mun.id;
  }

  if (existing) {
    const updated = await updateUser(existing.id, {
      name: input.name,
      role: input.role,
      departmentId: input.departmentId,
      assignedOfficerId: input.assignedOfficerId,
      municipalityId: defaultMunId,
      isAuthorized: input.isAuthorized ?? true,
      isSuspended: false,
    });
    return updated!;
  }

  const newUser = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email: cleanEmail,
      role: input.role as UserRole,
      departmentId: input.departmentId || null,
      assignedOfficerId: input.assignedOfficerId || null,
      municipalityId: defaultMunId,
      isAuthorized: input.isAuthorized ?? true,
      isSuspended: false,
      authProvider: AuthProvider.GOOGLE,
    },
  });

  return formatUserItem(newUser);
}

export async function updateUser(
  id: string,
  updates: Partial<Pick<UserItem, 'name' | 'email' | 'role' | 'departmentId' | 'assignedOfficerId' | 'municipalityId' | 'isAuthorized' | 'isSuspended'>>,
): Promise<UserItem | null> {
  try {
    const current = await prisma.user.findUnique({ where: { id } });
    if (!current) return null;

    let updatedRole = updates.role !== undefined ? (updates.role as UserRole) : current.role;
    let updatedAuthorized = updates.isAuthorized !== undefined ? updates.isAuthorized : current.isAuthorized;
    let updatedSuspended = updates.isSuspended !== undefined ? updates.isSuspended : current.isSuspended;

    if (
      current.role === UserRole.SUPER_ADMIN ||
      current.role === UserRole.ADMIN ||
      (current.email && isSuperAdminEmail(current.email))
    ) {
      updatedRole = UserRole.SUPER_ADMIN;
      updatedAuthorized = true;
      updatedSuspended = false;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        name: updates.name !== undefined ? updates.name.trim() : undefined,
        email: updates.email !== undefined ? updates.email.trim().toLowerCase() : undefined,
        role: updatedRole,
        departmentId: updates.departmentId !== undefined ? updates.departmentId : undefined,
        assignedOfficerId: updates.assignedOfficerId !== undefined ? updates.assignedOfficerId : undefined,
        municipalityId: updates.municipalityId !== undefined ? updates.municipalityId : undefined,
        isAuthorized: updatedAuthorized,
        isSuspended: updatedSuspended,
      },
    });

    return formatUserItem(updated);
  } catch {
    return null;
  }
}

export async function suspendUser(id: string, isSuspended: boolean): Promise<UserItem | null> {
  const target = await getUser(id);
  if (target && isSuperAdminTarget(target) && isSuspended) {
    return null; // Protected
  }
  if (isSuspended) {
    await prisma.refreshToken.deleteMany({ where: { userId: id } });
  }
  return updateUser(id, { isSuspended });
}

export type DeleteUserResult =
  | { success: true }
  | {
      success: false;
      reason:
        | 'NOT_FOUND'
        | 'SUPER_ADMIN_PROTECTED'
        | 'CITIZEN_HAS_COMPLAINTS'
        | 'CITIZEN_HAS_FEEDBACK'
        | 'STAFF_HAS_FIELD_WORKERS'
        | 'STAFF_HAS_OPEN_COMPLAINTS'
        | 'INTERNAL_ERROR';
      message: string;
    };

export async function deleteUser(id: string): Promise<DeleteUserResult> {
  try {
    const user = await getUser(id);
    if (!user) {
      return { success: false, reason: 'NOT_FOUND', message: 'User not found.' };
    }

    if (isSuperAdminTarget(user)) {
      return {
        success: false,
        reason: 'SUPER_ADMIN_PROTECTED',
        message: 'Super Admin accounts cannot be suspended, deactivated, or deleted.',
      };
    }

    const complaintCount = await prisma.complaint.count({ where: { citizenId: id } });
    if (complaintCount > 0) {
      return {
        success: false,
        reason: 'CITIZEN_HAS_COMPLAINTS',
        message: `Cannot delete user because they have submitted ${complaintCount} complaint(s).`,
      };
    }

    const feedbackCount = await prisma.feedback.count({ where: { citizenId: id } });
    if (feedbackCount > 0) {
      return {
        success: false,
        reason: 'CITIZEN_HAS_FEEDBACK',
        message: `Cannot delete user because they have submitted ${feedbackCount} feedback entry/entries.`,
      };
    }

    // Refuse delete if staff has assigned field workers
    const assignedWorkersCount = await prisma.user.count({ where: { assignedOfficerId: id } });
    if (assignedWorkersCount > 0) {
      return {
        success: false,
        reason: 'STAFF_HAS_FIELD_WORKERS',
        message: `Cannot delete staff member because they have ${assignedWorkersCount} assigned field worker(s). Reassign them first.`,
      };
    }

    // Refuse delete if staff has open complaints (assigned as field worker or officer)
    const openComplaintsCount = await prisma.complaint.count({
      where: {
        status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED', 'DUPLICATE'] },
        OR: [
          { assignedFieldWorkerId: id },
          { assignment: { departmentOfficerId: id } },
        ],
      },
    });
    if (openComplaintsCount > 0) {
      return {
        success: false,
        reason: 'STAFF_HAS_OPEN_COMPLAINTS',
        message: `Cannot delete staff member because they have ${openComplaintsCount} open complaint(s). Resolve or reassign them first.`,
      };
    }

    // Execute all cleanup operations + metadata snapshot + user deletion in a single atomic transaction
    await prisma.$transaction(async (tx) => {
      // 1. Delete refresh tokens & notifications
      await tx.refreshToken.deleteMany({ where: { userId: id } });
      await tx.notification.deleteMany({ where: { recipientUserId: id } });

      // 2. Clear field worker assignments & officer associations
      await tx.complaint.updateMany({
        where: { assignedFieldWorkerId: id },
        data: { assignedFieldWorkerId: null },
      });
      await tx.user.updateMany({
        where: { assignedOfficerId: id },
        data: { assignedOfficerId: null },
      });

      // 3. Delete assignments
      await tx.assignment.deleteMany({
        where: { OR: [{ departmentOfficerId: id }, { assignedByUserId: id }] },
      });

      // 4. Evidence Option A: Snapshot staff name into uploadedByName and null FK
      const staffNameSnapshot = user.name || 'Staff Member';
      await tx.evidence.updateMany({
        where: { uploadedByUserId: id },
        data: {
          uploadedByName: staffNameSnapshot,
          uploadedByUserId: null,
        },
      });

      // 5. Disassociate status histories
      await tx.statusHistory.updateMany({
        where: { changedByUserId: id },
        data: { changedByUserId: null },
      });

      // 5. Snapshot AuditLog metadata in bulk before onDelete: SetNull disassociates userId
      const actorNameStr = user.name || user.email || 'Deleted User';
      const actorEmailStr = user.email || '';
      await tx.$executeRaw(Prisma.sql`
        UPDATE audit_logs
        SET metadata = CASE
          WHEN metadata IS NULL THEN jsonb_build_object('actorName', ${actorNameStr}::text, 'actorEmail', ${actorEmailStr}::text)::json
          ELSE (to_jsonb(metadata) || jsonb_build_object(
            'actorName', COALESCE(to_jsonb(metadata)->>'actorName', ${actorNameStr}::text),
            'actorEmail', COALESCE(to_jsonb(metadata)->>'actorEmail', ${actorEmailStr}::text)
          ))::json
        END
        WHERE "userId" = ${id}
      `);

      // 6. Delete user (onDelete: SetNull automatically sets audit_logs.userId = NULL on foreign key relation)
      await tx.user.delete({ where: { id } });
    }, { timeout: 15000 });

    return { success: true };
  } catch (error: any) {
    console.error(`Error deleting user ${id}:`, error);
    return {
      success: false,
      reason: 'INTERNAL_ERROR',
      message: error?.message || 'Failed to delete user due to an internal error.',
    };
  }
}

export async function approveUser(
  id: string,
  role: UserItem['role'],
  departmentId?: string | null,
): Promise<UserItem | null> {
  return updateUser(id, {
    role,
    departmentId: role === 'ADMIN' ? null : departmentId,
    isAuthorized: true,
    isSuspended: false,
  });
}

export async function rejectUser(id: string): Promise<boolean> {
  const res = await deleteUser(id);
  return res.success;
}

export async function updateLastLogin(id: string): Promise<UserItem | null> {
  try {
    const updated = await prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
    return formatUserItem(updated);
  } catch {
    return null;
  }
}
