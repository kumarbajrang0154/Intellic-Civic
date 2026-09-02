import prisma from '@/lib/prisma';
import { UserRole, AuthProvider } from '@prisma/client';

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
  role: 'ADMIN' | 'DEPARTMENT_HEAD' | 'DEPARTMENT_OFFICER' | 'FIELD_WORKER' | 'CITIZEN' | null;
  departmentId: string | null;
  isAuthorized: boolean;
  isSuspended: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const SUPER_ADMIN_EMAIL = 'kumarbajrang325@gmail.com';

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
  email: string = SUPER_ADMIN_EMAIL,
  name: string = 'Bajrang Kumar (Super Admin)',
): Promise<UserItem> {
  const cleanEmail = email.toLowerCase().trim();

  let admin = await prisma.user.findFirst({
    where: { email: cleanEmail },
  });

  if (admin) {
    admin = await prisma.user.update({
      where: { id: admin.id },
      data: {
        role: UserRole.ADMIN,
        isAuthorized: true,
        isSuspended: false,
        name: admin.name || name,
      },
    });
  } else {
    admin = await prisma.user.create({
      data: {
        id: 'usr_super_admin',
        name,
        email: cleanEmail,
        role: UserRole.ADMIN,
        authProvider: AuthProvider.GOOGLE,
        departmentId: null,
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
  isAuthorized?: boolean;
}): Promise<UserItem> {
  const cleanEmail = input.email.trim().toLowerCase();
  const existing = await getUserByEmail(cleanEmail);

  if (existing) {
    const updated = await updateUser(existing.id, {
      name: input.name,
      role: input.role,
      departmentId: input.departmentId,
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
      isAuthorized: input.isAuthorized ?? true,
      isSuspended: false,
      authProvider: AuthProvider.GOOGLE,
    },
  });

  return formatUserItem(newUser);
}

export async function updateUser(
  id: string,
  updates: Partial<Pick<UserItem, 'name' | 'email' | 'role' | 'departmentId' | 'isAuthorized' | 'isSuspended'>>,
): Promise<UserItem | null> {
  try {
    const current = await prisma.user.findUnique({ where: { id } });
    if (!current) return null;

    let updatedRole = updates.role !== undefined ? (updates.role as UserRole) : current.role;
    let updatedAuthorized = updates.isAuthorized !== undefined ? updates.isAuthorized : current.isAuthorized;
    let updatedSuspended = updates.isSuspended !== undefined ? updates.isSuspended : current.isSuspended;

    if (current.email && current.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      updatedRole = UserRole.ADMIN;
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
  return updateUser(id, { isSuspended });
}

export async function deleteUser(id: string): Promise<boolean> {
  try {
    const user = await getUser(id);
    if (!user) return false;

    if (user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      return false;
    }

    await prisma.user.delete({ where: { id } });
    return true;
  } catch {
    return false;
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
  return deleteUser(id);
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
