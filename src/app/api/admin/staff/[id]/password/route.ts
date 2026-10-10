import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';
import { isSuperAdminTarget } from '@/lib/staff-dept-store';
import { addAuditLog } from '@/lib/audit-store';
import { validatePasswordPolicy } from '@/lib/password-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_STAFF_ROLES = ['DEPARTMENT_HEAD', 'DEPARTMENT_OFFICER', 'FIELD_WORKER', 'ADMIN'];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    const targetId = params.id;
    if (!targetId) {
      return NextResponse.json({ message: 'Target staff ID is required.' }, { status: 400 });
    }

  const actor = await prisma.user.findUnique({
    where: { id: auth.admin.id },
    select: { id: true, name: true, role: true, municipalityId: true },
  });

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      municipalityId: true,
      passwordHash: true,
      isSuspended: true,
      deletedAt: true,
    },
  });

  if (!target) {
    return NextResponse.json({ message: 'Staff member not found.' }, { status: 404 });
  }

  // Super Admin protection guard: never allow modifying Super Admin target
  if (target.role === 'SUPER_ADMIN' || isSuperAdminTarget(target)) {
    return NextResponse.json(
      { message: 'Forbidden: Super Admin accounts are protected.' },
      { status: 403 },
    );
  }

  // Citizens cannot have staff passwords set
  if (target.role === 'CITIZEN' || !target.role || !ALLOWED_STAFF_ROLES.includes(target.role)) {
    return NextResponse.json(
      { message: 'Forbidden: Passwords can only be managed for eligible staff accounts.' },
      { status: 403 },
    );
  }

  // Municipality isolation check (ADMIN, same municipality only)
  if (auth.admin.role === 'ADMIN' || actor?.role === 'ADMIN') {
    if (actor?.municipalityId && target.municipalityId !== actor.municipalityId) {
      return NextResponse.json(
        { message: 'Forbidden: Cannot manage password for staff in a different municipality.' },
        { status: 403 },
      );
    }
  }

  let body: { password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON request body.' }, { status: 400 });
  }

  const rawPassword = body?.password;
  if (!rawPassword || typeof rawPassword !== 'string') {
    return NextResponse.json({ message: 'Password is required.' }, { status: 400 });
  }

  // Validate server-side password policy
  const policyResult = validatePasswordPolicy(rawPassword, {
    email: target.email,
    name: target.name,
  });

  if (!policyResult.valid) {
    return NextResponse.json(
      { message: policyResult.error || 'Password does not meet security requirements.' },
      { status: 400 },
    );
  }

  const isReset = Boolean(target.passwordHash);
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  // Update user: set/replace hash, reset failed attempts & lockout state, do NOT set mustChangePassword
  await prisma.user.update({
    where: { id: target.id },
    data: {
      passwordHash,
      failedLoginCount: 0,
      lockedUntil: null,
      mustChangePassword: false,
    },
  });

  // Audit row with NO password and NO hash in metadata
  await addAuditLog({
    actorId: auth.admin.id,
    actorName: auth.admin.name,
    action: isReset ? 'STAFF_PASSWORD_RESET' : 'STAFF_PASSWORD_SET',
    entityType: 'User',
    targetId: target.id,
    targetName: target.name,
    metadata: {
      role: target.role,
      isReset,
    },
  });

    // Response never contains password or hash
    return NextResponse.json({
      success: true,
      message: isReset ? 'Staff password has been reset successfully.' : 'Staff password has been set successfully.',
    });
  } catch (error: any) {
    console.error('[STAFF PASSWORD ERROR]', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to update staff password.' },
      { status: 500 },
    );
  }
}
