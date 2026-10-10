import prisma from '@/lib/prisma';
import { UserRole, AuthProvider, Prisma } from '@prisma/client';
import { addAuditLog } from '@/lib/audit-store';

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
  deletedAt: string | null;
  lastLoginAt: string | null;
  loginId?: string | null;
  googleId?: string | null;
  hasPassword?: boolean;
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
    deletedAt: user.deletedAt ? (user.deletedAt instanceof Date ? user.deletedAt.toISOString() : new Date(user.deletedAt).toISOString()) : null,
    lastLoginAt: user.lastLoginAt ? (user.lastLoginAt instanceof Date ? user.lastLoginAt.toISOString() : new Date(user.lastLoginAt).toISOString()) : null,
    loginId: user.loginId || null,
    googleId: user.googleId || null,
    hasPassword: Boolean(user.passwordHash),
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
  includeArchived?: boolean;
}): Promise<UserItem[]> {
  const where: any = {};

  if (!filters?.includeArchived) {
    where.deletedAt = null;
  }

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
  passwordHash?: string | null;
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
    if (input.passwordHash) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash: input.passwordHash,
          mustChangePassword: false,
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
    }
    return (await getUser(existing.id))!;
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
      passwordHash: input.passwordHash || null,
      mustChangePassword: false,
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

export interface DeletePreflightResult {
  canHardDelete: boolean;
  canForceDelete: boolean;
  isSelf: boolean;
  isProtected: boolean;
  isSuperAdmin: boolean;
  isLastAdmin: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    role: string | null;
    isSuspended: boolean;
    deletedAt: string | null;
  };
  blockers: {
    openAssignedComplaints: number;
    resolvedComplaintsHandled: number;
    resolvedHandledCount: number;
    citizenComplaints: number;
    feedbacks: number;
    feedback: number;
    assignedWorkers: number;
    auditRows: number;
    evidence: number;
    notifications: number;
    statusHistory: number;
    pendingApprovals: number;
    assignments: number;
  };
  openComplaints: Array<{
    id: string;
    ticketId: string;
    title: string;
    status: string;
    priority: string | null;
  }>;
  reasons: string[];
}

export async function getDeletePreflight(targetId: string, actorId?: string): Promise<DeletePreflightResult | null> {
  const user = await prisma.user.findUnique({
    where: { id: targetId },
  });

  if (!user) {
    return null;
  }

  const isSelf = actorId ? actorId === targetId : false;
  const isProtected = isSuperAdminTarget(user);
  const isSuperAdmin = isProtected;

  let isLastAdmin = false;
  if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
    const adminCount = await prisma.user.count({
      where: {
        role: { in: ['ADMIN', 'SUPER_ADMIN'] },
        isSuspended: false,
        deletedAt: null,
      },
    });
    isLastAdmin = adminCount <= 1;
  }

  const [
    openAssignedComplaints,
    resolvedComplaintsHandled,
    citizenComplaints,
    feedbacks,
    assignedWorkers,
    auditRows,
    evidence,
    notifications,
    statusHistory,
    assignmentsCount,
    openComplaintsList,
  ] = await Promise.all([
    prisma.complaint.count({
      where: {
        status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED', 'DUPLICATE'] },
        OR: [
          { assignedFieldWorkerId: targetId },
          { assignment: { departmentOfficerId: targetId } },
        ],
      },
    }),
    prisma.complaint.count({
      where: {
        status: { in: ['RESOLVED', 'CLOSED', 'REJECTED', 'DUPLICATE'] },
        OR: [
          { assignedFieldWorkerId: targetId },
          { assignment: { departmentOfficerId: targetId } },
        ],
      },
    }),
    prisma.complaint.count({
      where: { citizenId: targetId },
    }),
    prisma.feedback.count({
      where: { citizenId: targetId },
    }),
    prisma.user.count({
      where: { assignedOfficerId: targetId },
    }),
    prisma.auditLog.count({
      where: { userId: targetId },
    }),
    prisma.evidence.count({
      where: { uploadedByUserId: targetId },
    }),
    prisma.notification.count({
      where: { recipientUserId: targetId },
    }),
    prisma.statusHistory.count({
      where: { changedByUserId: targetId },
    }),
    prisma.assignment.count({
      where: {
        OR: [
          { departmentOfficerId: targetId },
          { assignedByUserId: targetId },
        ],
      },
    }),
    prisma.complaint.findMany({
      where: {
        status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED', 'DUPLICATE'] },
        OR: [
          { assignedFieldWorkerId: targetId },
          { assignment: { departmentOfficerId: targetId } },
        ],
      },
      take: 20,
      select: {
        id: true,
        ticketId: true,
        title: true,
        status: true,
        priority: true,
      },
    }),
  ]);

  const pendingApprovals = !user.isAuthorized ? 1 : 0;

  const reasons: string[] = [];
  if (isSelf) {
    reasons.push('You cannot delete your own account.');
  }
  if (isProtected) {
    reasons.push('Super Admin accounts are permanently protected and cannot be deleted.');
  }
  if (isLastAdmin) {
    reasons.push('Cannot delete the last remaining active Administrator account.');
  }
  if (openAssignedComplaints > 0) {
    reasons.push(`User has ${openAssignedComplaints} open assigned complaint(s). Reassign them first.`);
  }
  if (assignedWorkers > 0) {
    reasons.push(`User has ${assignedWorkers} assigned field worker(s). Reassign them first.`);
  }
  if (citizenComplaints > 0) {
    reasons.push(`User has submitted ${citizenComplaints} citizen complaint(s). Complaint history cannot be hard-deleted.`);
  }
  if (feedbacks > 0) {
    reasons.push(`User has submitted ${feedbacks} feedback review(s).`);
  }

  const blockers = {
    openAssignedComplaints,
    resolvedComplaintsHandled,
    resolvedHandledCount: resolvedComplaintsHandled,
    citizenComplaints,
    feedbacks,
    feedback: feedbacks,
    assignedWorkers,
    auditRows,
    evidence,
    notifications,
    statusHistory,
    pendingApprovals,
    assignments: assignmentsCount,
  };

  const totalBlockers =
    openAssignedComplaints +
    citizenComplaints +
    feedbacks +
    assignedWorkers;

  const canHardDelete = !isSelf && !isProtected && !isLastAdmin && totalBlockers === 0;
  const canForceDelete = !isSelf && !isProtected && !isLastAdmin && user.role !== 'CITIZEN';

  return {
    canHardDelete,
    canForceDelete,
    isSelf,
    isProtected,
    isSuperAdmin,
    isLastAdmin,
    user: {
      id: user.id,
      name: user.name,
      email: user.email || '',
      role: user.role,
      isSuspended: user.isSuspended,
      deletedAt: user.deletedAt ? user.deletedAt.toISOString() : null,
    },
    blockers,
    openComplaints: openComplaintsList,
    reasons,
  };
}

export type DeleteUserResult =
  | { success: true }
  | {
      success: false;
      reason:
        | 'NOT_FOUND'
        | 'SUPER_ADMIN_PROTECTED'
        | 'LAST_ADMIN_PROTECTED'
        | 'SELF_DELETE_PROTECTED'
        | 'BLOCKERS_EXIST'
        | 'CITIZEN_HAS_COMPLAINTS'
        | 'CITIZEN_HAS_FEEDBACK'
        | 'STAFF_HAS_FIELD_WORKERS'
        | 'STAFF_HAS_OPEN_COMPLAINTS'
        | 'INTERNAL_ERROR';
      message: string;
      blockers?: DeletePreflightResult['blockers'];
      reasons?: string[];
    };

export async function deleteUser(id: string, actorId?: string): Promise<DeleteUserResult> {
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

    const preflight = await getDeletePreflight(id, actorId);
    if (preflight && !preflight.canHardDelete) {
      let primaryReason: (DeleteUserResult & { success: false })['reason'] = 'BLOCKERS_EXIST';
      if (preflight.isSelf) {
        primaryReason = 'SELF_DELETE_PROTECTED';
      } else if (preflight.isLastAdmin) {
        primaryReason = 'LAST_ADMIN_PROTECTED';
      } else if (preflight.blockers.assignedWorkers > 0) {
        primaryReason = 'STAFF_HAS_FIELD_WORKERS';
      } else if (preflight.blockers.openAssignedComplaints > 0) {
        primaryReason = 'STAFF_HAS_OPEN_COMPLAINTS';
      } else if (preflight.blockers.citizenComplaints > 0) {
        primaryReason = 'CITIZEN_HAS_COMPLAINTS';
      } else if (preflight.blockers.feedbacks > 0) {
        primaryReason = 'CITIZEN_HAS_FEEDBACK';
      }

      return {
        success: false,
        reason: primaryReason,
        message: `Cannot delete user: ${preflight.reasons.join(' ')}`,
        blockers: preflight.blockers,
        reasons: preflight.reasons,
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

      // 6. Snapshot AuditLog metadata in bulk before onDelete: SetNull disassociates userId
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

      // 7. Delete user (onDelete: SetNull automatically sets audit_logs.userId = NULL on foreign key relation)
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

export async function archiveUser(
  targetId: string,
  actor: { id: string; name: string },
): Promise<{ ok: boolean; status: number; message: string; data?: any }> {
  const user = await prisma.user.findUnique({
    where: { id: targetId },
  });

  if (!user) {
    return { ok: false, status: 404, message: 'User not found.' };
  }

  if (targetId === actor.id) {
    return { ok: false, status: 400, message: 'You cannot archive your own account.' };
  }

  if (isSuperAdminTarget(user)) {
    return { ok: false, status: 403, message: 'Super Admin accounts cannot be archived or deleted.' };
  }

  if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
    const adminCount = await prisma.user.count({
      where: {
        role: { in: ['ADMIN', 'SUPER_ADMIN'] },
        isSuspended: false,
        deletedAt: null,
      },
    });
    if (adminCount <= 1) {
      return { ok: false, status: 403, message: 'Cannot archive the last remaining Administrator account.' };
    }
  }

  const now = new Date();
  const tombstoneEmail = `archived_${user.id.slice(0, 8)}_${Date.now()}@deleted.local`;
  const originalEmail = user.email;

  await prisma.$transaction(async (tx) => {
    // 1. Delete refresh tokens
    await tx.refreshToken.deleteMany({ where: { userId: targetId } });

    // 2. Option A Evidence snapshot: preserve name snapshot in uploadedByName and disassociate uploadedByUserId
    const staffNameSnapshot = user.name || 'Staff Member';
    await tx.evidence.updateMany({
      where: { uploadedByUserId: targetId },
      data: {
        uploadedByName: staffNameSnapshot,
        uploadedByUserId: null,
      },
    });

    // 3. Update user: set deletedAt, isSuspended, tombstone email, clear googleId & mobileNumber to free credentials
    await tx.user.update({
      where: { id: targetId },
      data: {
        deletedAt: now,
        isSuspended: true,
        suspendedAt: now,
        email: tombstoneEmail,
        googleId: null,
        mobileNumber: null,
      },
    });
  });

  await addAuditLog({
    actorId: actor.id,
    actorName: actor.name,
    action: 'USER_ARCHIVED',
    entityType: 'User',
    targetId,
    targetName: user.name,
    metadata: {
      originalEmail,
      tombstoneEmail,
      originalRole: user.role,
    },
  });

  return {
    ok: true,
    status: 200,
    message: 'User archived successfully.',
    data: {
      archived: true,
      originalEmail,
      tombstoneEmail,
      originalRole: user.role,
      name: user.name,
      deletedAt: now.toISOString(),
    },
  };
}

export async function reassignUserComplaints(
  sourceUserId: string,
  targetStaffId: string,
  actor: { id: string; name: string },
): Promise<{ ok: boolean; status: number; message: string; data?: any }> {
  if (sourceUserId === targetStaffId) {
    return { ok: false, status: 400, message: 'Target staff member must be different from source staff.' };
  }

  const sourceUser = await prisma.user.findUnique({ where: { id: sourceUserId } });
  if (!sourceUser) {
    return { ok: false, status: 404, message: 'Source user not found.' };
  }

  const targetStaff = await prisma.user.findUnique({ where: { id: targetStaffId } });
  if (!targetStaff || targetStaff.isSuspended || targetStaff.deletedAt) {
    return { ok: false, status: 400, message: 'Target staff member not found or is inactive.' };
  }

  let count = 0;

  await prisma.$transaction(async (tx) => {
    // 1. Reassign open complaints where assignedFieldWorkerId === sourceUserId
    const fwRes = await tx.complaint.updateMany({
      where: {
        assignedFieldWorkerId: sourceUserId,
        status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED', 'DUPLICATE'] },
      },
      data: {
        assignedFieldWorkerId: targetStaffId,
      },
    });
    count += fwRes.count;

    // 2. Reassign open assignments where departmentOfficerId === sourceUserId
    const officerOpenComplaints = await tx.complaint.findMany({
      where: {
        assignment: { departmentOfficerId: sourceUserId },
        status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED', 'DUPLICATE'] },
      },
      select: { id: true },
    });

    if (officerOpenComplaints.length > 0) {
      const ids = officerOpenComplaints.map((c) => c.id);
      const assignRes = await tx.assignment.updateMany({
        where: {
          complaintId: { in: ids },
          departmentOfficerId: sourceUserId,
        },
        data: {
          departmentOfficerId: targetStaffId,
        },
      });
      count += assignRes.count;
    }

    // 3. Reassign supervised field workers if source was an officer
    const workerRes = await tx.user.updateMany({
      where: { assignedOfficerId: sourceUserId },
      data: { assignedOfficerId: targetStaffId },
    });
    count += workerRes.count;
  });

  await addAuditLog({
    actorId: actor.id,
    actorName: actor.name,
    action: 'COMPLAINTS_REASSIGNED',
    entityType: 'User',
    targetId: sourceUserId,
    targetName: sourceUser.name,
    metadata: {
      sourceUserId,
      targetStaffId,
      targetStaffName: targetStaff.name,
      reassignedCount: count,
    },
  });

  return {
    ok: true,
    status: 200,
    message: `Successfully reassigned ${count} items.`,
    data: {
      reassignedCount: count,
      sourceUserId,
      targetStaffId,
      targetStaffName: targetStaff.name,
    },
  };
}

export async function approveUser(
  id: string,
  role: UserItem['role'],
  departmentId?: string | null,
): Promise<UserItem | null> {
  const needsDept = role === 'DEPARTMENT_OFFICER' || role === 'FIELD_WORKER';
  return updateUser(id, {
    role,
    departmentId: needsDept ? (departmentId || null) : null,
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

export interface PermanentDeleteInput {
  confirmEmail?: string;
  openComplaintsAction?: 'reassign' | 'unassign';
  reassignToId?: string;
  forceRollbackForTest?: boolean;
}

export interface PermanentDeleteResult {
  ok: boolean;
  status: number;
  message: string;
  data?: {
    deleted: boolean;
    message: string;
    targetId: string;
    targetEmail: string;
    targetName: string;
    openComplaintsAction: string;
    reassignedCount: number;
    unassignedCount: number;
    detachedWorkersCount: number;
    evidencePreservedCount: number;
  };
}

export async function permanentlyDeleteUser(
  targetId: string,
  input: PermanentDeleteInput,
  actor: { id: string; name: string; role?: string; municipalityId?: string | null },
): Promise<PermanentDeleteResult> {
  const targetUser = await prisma.user.findUnique({
    where: { id: targetId },
    include: { department: true, municipality: true },
  });

  if (!targetUser) {
    return { ok: false, status: 404, message: 'Staff member not found.' };
  }

  // 1. Self delete protection
  if (targetId === actor.id) {
    return { ok: false, status: 400, message: 'You cannot delete your own account.' };
  }

  // 2. Super Admin protection (protected platform-wide)
  if (targetUser.role === 'SUPER_ADMIN' || isSuperAdminTarget(targetUser)) {
    return { ok: false, status: 403, message: 'Super Admin accounts are permanently protected and cannot be deleted.' };
  }

  // 3. Last admin protection
  if (targetUser.role === 'ADMIN') {
    const adminCount = await prisma.user.count({
      where: {
        role: { in: ['ADMIN', 'SUPER_ADMIN'] },
        isSuspended: false,
        deletedAt: null,
      },
    });
    if (adminCount <= 1) {
      return { ok: false, status: 403, message: 'Cannot delete the last remaining Administrator account.' };
    }
  }

  // 4. Same municipality check
  let actorMunicipalityId = actor.municipalityId;
  if (!actorMunicipalityId) {
    const actorRecord = await prisma.user.findUnique({
      where: { id: actor.id },
      select: { municipalityId: true },
    });
    actorMunicipalityId = actorRecord?.municipalityId || null;
  }
  if (actorMunicipalityId && targetUser.municipalityId && actorMunicipalityId !== targetUser.municipalityId) {
    return { ok: false, status: 403, message: 'Forbidden: Staff member belongs to a different municipality.' };
  }

  // 5. Staff check (block CITIZEN)
  if (targetUser.role === 'CITIZEN') {
    return { ok: false, status: 400, message: 'Target user is a citizen, not a staff member.' };
  }

  // 6. Email confirmation check (case-insensitive)
  const normalizedTargetEmail = (targetUser.email || '').trim().toLowerCase();
  const normalizedConfirmEmail = (input.confirmEmail || '').trim().toLowerCase();
  if (!normalizedConfirmEmail || normalizedConfirmEmail !== normalizedTargetEmail) {
    return {
      ok: false,
      status: 400,
      message: 'Confirmation email does not match staff email. You must type the staff email to confirm.',
    };
  }

  // 7. Find open complaints assigned to this staff member
  const openComplaints = await prisma.complaint.findMany({
    where: {
      status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED', 'DUPLICATE'] },
      OR: [
        { assignedFieldWorkerId: targetId },
        { assignment: { departmentOfficerId: targetId } },
      ],
    },
    select: {
      id: true,
      ticketId: true,
      title: true,
      status: true,
      assignedFieldWorkerId: true,
      departmentId: true,
    },
  });

  if (openComplaints.length > 0) {
    if (!input.openComplaintsAction || !['reassign', 'unassign'].includes(input.openComplaintsAction)) {
      return {
        ok: false,
        status: 400,
        message: 'openComplaintsAction ("reassign" or "unassign") is required when staff has open complaints.',
      };
    }

    if (input.openComplaintsAction === 'reassign') {
      if (!input.reassignToId) {
        return { ok: false, status: 400, message: 'reassignToId is required when openComplaintsAction is "reassign".' };
      }
      if (input.reassignToId === targetId) {
        return { ok: false, status: 400, message: 'Cannot reassign complaints to the staff member being deleted.' };
      }
      const targetStaff = await prisma.user.findUnique({
        where: { id: input.reassignToId },
      });
      if (!targetStaff || targetStaff.isSuspended || targetStaff.deletedAt) {
        return { ok: false, status: 400, message: 'Selected reassign target staff member is inactive or not found.' };
      }
      if (targetStaff.role === 'CITIZEN') {
        return { ok: false, status: 400, message: 'Cannot reassign complaints to a citizen.' };
      }
      if (actor.municipalityId && targetStaff.municipalityId && actor.municipalityId !== targetStaff.municipalityId) {
        return { ok: false, status: 400, message: 'Target staff member must belong to the same municipality.' };
      }
    }
  }

  try {
    let reassignedCount = 0;
    let unassignedCount = 0;
    let detachedWorkersCount = 0;
    let evidencePreservedCount = 0;

    await prisma.$transaction(async (tx) => {
      // a. Open complaints handling
      if (openComplaints.length > 0) {
        if (input.openComplaintsAction === 'reassign' && input.reassignToId) {
          // Reassign open worker assignments
          await tx.complaint.updateMany({
            where: {
              assignedFieldWorkerId: targetId,
              status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED', 'DUPLICATE'] },
            },
            data: { assignedFieldWorkerId: input.reassignToId },
          });

          // Reassign open officer assignments
          await tx.assignment.updateMany({
            where: {
              departmentOfficerId: targetId,
              complaint: { status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED', 'DUPLICATE'] } },
            },
            data: { departmentOfficerId: input.reassignToId },
          });

          reassignedCount = openComplaints.length;

          // Status history notes
          for (const c of openComplaints) {
            await tx.statusHistory.create({
              data: {
                complaintId: c.id,
                fromStatus: c.status,
                toStatus: c.status,
                notes: `Reassigned from deleted staff ${targetUser.name} to target staff.`,
                changedByUserId: actor.id,
              },
            });
          }
        } else if (input.openComplaintsAction === 'unassign') {
          // Unassign open worker assignments
          await tx.complaint.updateMany({
            where: {
              assignedFieldWorkerId: targetId,
              status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED', 'DUPLICATE'] },
            },
            data: {
              assignedFieldWorkerId: null,
              status: 'PENDING_DEPT_REVIEW',
            },
          });

          // Delete open officer assignments
          await tx.assignment.deleteMany({
            where: {
              departmentOfficerId: targetId,
              complaint: { status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED', 'DUPLICATE'] } },
            },
          });

          // Set status back to triage-able state PENDING_DEPT_REVIEW
          await tx.complaint.updateMany({
            where: {
              id: { in: openComplaints.map((c) => c.id) },
              status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
            },
            data: { status: 'PENDING_DEPT_REVIEW' },
          });

          unassignedCount = openComplaints.length;

          // Status history notes
          for (const c of openComplaints) {
            await tx.statusHistory.create({
              data: {
                complaintId: c.id,
                fromStatus: c.status,
                toStatus: 'PENDING_DEPT_REVIEW',
                notes: `Staff unassigned due to permanent account deletion. Returned to triage pool.`,
                changedByUserId: actor.id,
              },
            });
          }
        }
      }

      // b. Any remaining assignments (closed/resolved complaints or assignments created by user)
      await tx.assignment.deleteMany({
        where: { departmentOfficerId: targetId },
      });
      await tx.assignment.updateMany({
        where: { assignedByUserId: targetId },
        data: { assignedByUserId: actor.id },
      });

      // c. Detach field workers under this officer
      const detachedWorkers = await tx.user.updateMany({
        where: { assignedOfficerId: targetId },
        data: { assignedOfficerId: null },
      });
      detachedWorkersCount = detachedWorkers.count;

      // d. Evidence Option A: snapshot uploader name, null FK
      const staffNameSnapshot = targetUser.name || 'Staff Member';
      const evidenceRes = await tx.evidence.updateMany({
        where: { uploadedByUserId: targetId },
        data: {
          uploadedByName: staffNameSnapshot,
          uploadedByUserId: null,
        },
      });
      evidencePreservedCount = evidenceRes.count;

      // e. Delete notifications & refresh tokens
      await tx.notification.deleteMany({ where: { recipientUserId: targetId } });
      await tx.refreshToken.deleteMany({ where: { userId: targetId } });

      // f. Null status history changedByUserId
      await tx.statusHistory.updateMany({
        where: { changedByUserId: targetId },
        data: { changedByUserId: null },
      });

      // g. Audit rows: snapshot actor name and email into metadata, set userId = null
      const actorNameStr = targetUser.name || targetUser.email || 'Deleted Staff';
      const actorEmailStr = targetUser.email || '';
      await tx.$executeRaw(Prisma.sql`
        UPDATE audit_logs
        SET metadata = CASE
          WHEN metadata IS NULL THEN jsonb_build_object('actorName', ${actorNameStr}::text, 'actorEmail', ${actorEmailStr}::text)::json
          ELSE (to_jsonb(metadata) || jsonb_build_object(
            'actorName', COALESCE(to_jsonb(metadata)->>'actorName', ${actorNameStr}::text),
            'actorEmail', COALESCE(to_jsonb(metadata)->>'actorEmail', ${actorEmailStr}::text)
          ))::json
        END,
        "userId" = NULL
        WHERE "userId" = ${targetId}
      `);

      // h. Feedback refs
      await tx.feedback.deleteMany({ where: { citizenId: targetId } });

      // i. Forced rollback hook for rollback testing
      if (input.forceRollbackForTest) {
        throw new Error('FORCED_TRANSACTION_ROLLBACK_TEST');
      }

      // j. Delete user row permanently
      await tx.user.delete({ where: { id: targetId } });

      // k. Create one permanent deletion audit log row (actor.id is userId, surviving user delete)
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: 'STAFF_PERMANENTLY_DELETED',
          entityType: 'User',
          entityId: targetId,
          metadata: {
            targetName: targetUser.name,
            targetEmail: targetUser.email,
            targetRole: targetUser.role,
            targetDepartmentName: targetUser.department?.name || null,
            targetDepartmentId: targetUser.departmentId || null,
            deletedBy: actor.name,
            deletedById: actor.id,
            openComplaintsAction: input.openComplaintsAction || 'none',
            reassignedCount,
            unassignedCount,
            detachedWorkersCount,
            evidencePreservedCount,
          },
        },
      });
    }, { timeout: 30000 });

    return {
      ok: true,
      status: 200,
      message: 'Staff member permanently deleted.',
      data: {
        deleted: true,
        message: 'Staff member permanently deleted.',
        targetId,
        targetEmail: targetUser.email || '',
        targetName: targetUser.name,
        openComplaintsAction: input.openComplaintsAction || 'none',
        reassignedCount,
        unassignedCount,
        detachedWorkersCount,
        evidencePreservedCount,
      },
    };
  } catch (error: any) {
    console.error(`Error permanently deleting staff ${targetId}:`, error);
    return {
      ok: false,
      status: 500,
      message: error?.message || 'Failed to permanently delete staff member due to an internal error.',
    };
  }
}

