import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { suspendCitizen } from '@/services/citizenAdminService';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    const citizenId = params.id;
    let reason = 'Administrative action';
    try {
      const body = await req.json();
      if (body.reason) reason = body.reason;
    } catch {
      // Body optional
    }

    const result = await suspendCitizen(citizenId, reason, auth.admin);
    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.message }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      citizen: {
        id: result.citizen.id,
        isSuspended: result.citizen.isSuspended,
        suspendedAt: result.citizen.suspendedAt?.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[API ADMIN CITIZEN SUSPEND ERROR]', error);
    return NextResponse.json(
      { success: false, message: 'Failed to suspend citizen account', error: error.message },
      { status: 500 },
    );
  }
}
