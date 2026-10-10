import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { permanentlyDeleteStaff } from '@/services/staffService';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  context: { params: { id: string } },
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const { id } = await Promise.resolve(context.params);
  if (!id) {
    return NextResponse.json({ message: 'Staff ID is required.' }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { confirmEmail, openComplaintsAction, reassignToId, forceRollbackForTest } = body;

  const result = await permanentlyDeleteStaff(
    id,
    {
      confirmEmail,
      openComplaintsAction,
      reassignToId,
      forceRollbackForTest,
    },
    auth.admin,
  );

  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  return NextResponse.json(result.data, { status: 200 });
}
