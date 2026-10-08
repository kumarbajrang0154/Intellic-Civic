import { addAuditLog } from '@/lib/audit-store';
import prisma from '@/lib/prisma';
import { deleteUser } from '@/lib/staff-dept-store';
import { UserRole } from '@prisma/client';

export async function suspendCitizen(
  citizenId: string,
  reason: string = 'Administrative action',
  actor: { id: string; name: string },
): Promise<{ ok: boolean; status: number; message: string; citizen?: any }> {
  const citizen = await prisma.user.findFirst({
    where: { id: citizenId, role: UserRole.CITIZEN },
  });
  if (!citizen) {
    return { ok: false, status: 404, message: 'Citizen profile not found' };
  }
  if (citizen.isSuspended) {
    return { ok: false, status: 400, message: 'Citizen account is already suspended' };
  }

  const now = new Date();
  await prisma.refreshToken.deleteMany({ where: { userId: citizenId } });

  const updated = await prisma.user.update({
    where: { id: citizenId },
    data: {
      isSuspended: true,
      suspendedAt: now,
    },
  });

  await addAuditLog({
    actorId: actor.id,
    actorName: actor.name,
    action: 'CITIZEN_SUSPEND',
    entityType: 'CITIZEN',
    targetId: citizen.id,
    targetName: citizen.name || citizen.mobileNumber || citizen.email || citizen.id,
    metadata: {
      suspendedAt: now.toISOString(),
      reason,
    },
  });

  return { ok: true, status: 200, message: 'Citizen account suspended successfully', citizen: updated };
}

export async function activateCitizen(
  citizenId: string,
  actor: { id: string; name: string },
): Promise<{ ok: boolean; status: number; message: string; citizen?: any }> {
  const citizen = await prisma.user.findFirst({
    where: { id: citizenId, role: UserRole.CITIZEN },
  });
  if (!citizen) {
    return { ok: false, status: 404, message: 'Citizen profile not found' };
  }
  if (!citizen.isSuspended && !citizen.deletedAt) {
    return { ok: false, status: 400, message: 'Citizen account is already active' };
  }

  const updated = await prisma.user.update({
    where: { id: citizenId },
    data: {
      isSuspended: false,
      suspendedAt: null,
      deletedAt: null,
    },
  });

  await addAuditLog({
    actorId: actor.id,
    actorName: actor.name,
    action: 'CITIZEN_ACTIVATE',
    entityType: 'CITIZEN',
    targetId: citizen.id,
    targetName: citizen.name || citizen.mobileNumber || citizen.email || citizen.id,
    metadata: {
      activatedAt: new Date().toISOString(),
      previousStatus: citizen.deletedAt ? 'DELETED' : 'SUSPENDED',
    },
  });

  return { ok: true, status: 200, message: 'Citizen account activated successfully', citizen: updated };
}

export async function deleteCitizen(
  citizenId: string,
  actor: { id: string; name: string },
): Promise<{ ok: boolean; status: number; message: string }> {
  const citizen = await prisma.user.findFirst({
    where: { id: citizenId, role: UserRole.CITIZEN },
  });
  if (!citizen) {
    return { ok: false, status: 404, message: 'Citizen profile not found' };
  }

  const res = await deleteUser(citizenId);
  if (!res.success) {
    const status =
      res.reason === 'CITIZEN_HAS_COMPLAINTS' || res.reason === 'CITIZEN_HAS_FEEDBACK'
        ? 409
        : res.reason === 'NOT_FOUND'
        ? 404
        : 500;
    return { ok: false, status, message: res.message };
  }

  await addAuditLog({
    actorId: actor.id,
    actorName: actor.name,
    action: 'CITIZEN_DELETED',
    entityType: 'CITIZEN',
    targetId: citizen.id,
    targetName: citizen.name || citizen.mobileNumber || citizen.email || citizen.id,
    metadata: { email: citizen.email, mobileNumber: citizen.mobileNumber },
  });

  return { ok: true, status: 200, message: 'Citizen deleted successfully' };
}
