import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { getPlatformSettings, updatePlatformSettings } from '@/lib/settings-store';
import prisma from '@/lib/prisma';

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const settings = await getPlatformSettings();
    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error: any) {
    console.error('[ADMIN SETTINGS GET ERROR]:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch platform settings', error: error.message },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireSuperAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json();

    // Field Validation Checks
    if (body.supportEmail && !body.supportEmail.includes('@')) {
      return NextResponse.json(
        { success: false, message: 'Support email must be a valid email address' },
        { status: 400 },
      );
    }

    if (body.platformName && body.platformName.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: 'Platform Name cannot be empty' },
        { status: 400 },
      );
    }

    const updatedSettings = await updatePlatformSettings(body);

    // Record Audit Log Entry
    try {
      await prisma.auditLog.create({
        data: {
          userId: auth.admin.id,
          action: 'UPDATE_PLATFORM_SETTINGS',
          entityType: 'PLATFORM_SETTINGS',
          entityId: 'global',
          metadata: {
            updatedBy: auth.admin.email,
            updatedAt: new Date().toISOString(),
            fieldsUpdated: Object.keys(body),
          },
        },
      });
    } catch (auditErr) {
      console.warn('[AUDIT LOG WARNING] Failed to create audit log for settings update:', auditErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Platform settings updated successfully',
      settings: updatedSettings,
    });
  } catch (error: any) {
    console.error('[ADMIN SETTINGS PATCH ERROR]:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update platform settings', error: error.message },
      { status: 500 },
    );
  }
}
