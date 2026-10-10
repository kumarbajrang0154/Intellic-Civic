import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';
import { isSuperAdminTarget } from '@/lib/staff-dept-store';
import { addAuditLog } from '@/lib/audit-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_STAFF_ROLES = ['DEPARTMENT_HEAD', 'DEPARTMENT_OFFICER', 'FIELD_WORKER', 'ADMIN'];

function generate12CharPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const specials = '!@#$%^&*';
  const all = upper + lower + digits + specials;

  const chars = [
    upper[crypto.randomInt(0, upper.length)],
    lower[crypto.randomInt(0, lower.length)],
    digits[crypto.randomInt(0, digits.length)],
    specials[crypto.randomInt(0, specials.length)],
  ];

  for (let i = chars.length; i < 12; i++) {
    chars.push(all[crypto.randomInt(0, all.length)]);
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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
      loginId: true,
      isSuspended: true,
      deletedAt: true,
    },
  });

  if (!target) {
    return NextResponse.json({ message: 'Staff member not found.' }, { status: 404 });
  }

  // Super Admin protection guard
  if (target.role === 'SUPER_ADMIN' || isSuperAdminTarget(target)) {
    return NextResponse.json(
      { message: 'Forbidden: Super Admin accounts are protected.' },
      { status: 403 },
    );
  }

  // Citizens cannot have staff credentials
  if (target.role === 'CITIZEN' || !target.role || !ALLOWED_STAFF_ROLES.includes(target.role)) {
    return NextResponse.json(
      { message: 'Forbidden: Credentials can only be managed for eligible staff accounts.' },
      { status: 403 },
    );
  }

  // Municipality isolation check (ADMIN, same municipality only)
  if (auth.admin.role === 'ADMIN' || actor?.role === 'ADMIN') {
    if (actor?.municipalityId && target.municipalityId !== actor.municipalityId) {
      return NextResponse.json(
        { message: 'Forbidden: Cannot manage credentials for staff in a different municipality.' },
        { status: 403 },
      );
    }
  }

  let body: { reset?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional
  }
  const isReset = Boolean(body?.reset);

  // Generate unique loginId if missing
  let loginId = target.loginId;
  if (!loginId) {
    const prefixMap: Record<string, string> = {
      ADMIN: 'ADM',
      DEPARTMENT_HEAD: 'DHD',
      DEPARTMENT_OFFICER: 'OFF',
      FIELD_WORKER: 'FWK',
    };
    const prefix = (target.role && prefixMap[target.role]) || 'STF';
    let attempts = 0;
    while (!loginId && attempts < 15) {
      attempts++;
      const candidate = `${prefix}${Math.floor(100000 + Math.random() * 900000)}`;
      const existing = await prisma.user.findUnique({ where: { loginId: candidate } });
      if (!existing) {
        loginId = candidate;
      }
    }
    if (!loginId) {
      loginId = `${prefix}${Date.now().toString().slice(-6)}`;
    }
  }

  // Generate 12-char temporary password and hash it
  const password = generate12CharPassword();
  const passwordHash = await bcrypt.hash(password, 10);

  // Store hash, loginId, and reset lockout state. Plaintext is never stored.
  await prisma.user.update({
    where: { id: target.id },
    data: {
      loginId,
      passwordHash,
      mustChangePassword: true,
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });

  // Audit row without the password
  await addAuditLog({
    actorId: auth.admin.id,
    actorName: auth.admin.name,
    action: isReset ? 'STAFF_PASSWORD_RESET' : 'STAFF_CREDENTIALS_GENERATED',
    entityType: 'User',
    targetId: target.id,
    targetName: target.name,
    metadata: {
      role: target.role,
      loginId,
      isReset,
    },
  });

  // Return plaintext password ONCE in this response only
  return NextResponse.json({
    success: true,
    loginId,
    password,
    mustChangePassword: true,
    isReset,
    message: isReset
      ? 'Password reset successfully. Save the temporary password now; it will not be displayed again.'
      : 'Credentials generated successfully. Save the temporary password now; it will not be displayed again.',
  });
}
