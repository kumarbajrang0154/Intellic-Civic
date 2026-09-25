/**
 * Staff Self-Profile API
 * GET  /api/staff/profile  — returns the current logged-in staff user's profile
 * PUT  /api/staff/profile  — updates name and/or avatarUrl for the current staff user
 *
 * Accessible to any authenticated non-citizen staff role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import prisma from '@/lib/prisma';

export async function GET() {
  const auth = await requireStaff();
  if (!auth.authorized) return auth.response;

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        departmentId: true,
        isAuthorized: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ message: 'User not found.' }, { status: 404 });
    }

    return NextResponse.json({ profile: user });
  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to fetch profile.', error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireStaff();
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const { name, avatarUrl } = body;

    const updateData: { name?: string; avatarUrl?: string | null } = {};

    if (name !== undefined && name.trim()) {
      updateData.name = name.trim();
    }

    if (avatarUrl !== undefined) {
      updateData.avatarUrl = avatarUrl || null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ message: 'No fields to update.' }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: auth.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        departmentId: true,
        isAuthorized: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, profile: updated });
  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to update profile.', error: error.message }, { status: 500 });
  }
}
