import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { captureException } from '@/lib/error-monitoring';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import { validateComplaintIdParam } from '@/lib/validation';
import {
  listComplaintMaterials,
  MaterialServiceError,
  recordComplaintMaterialEntry,
} from '@/services/material-cost-service';

export const dynamic = 'force-dynamic';

const MATERIAL_TRACKING_ALLOWED_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'DEPARTMENT_HEAD',
  'DEPARTMENT_OFFICER',
] as const;

function handleRouteError(error: unknown, method: 'GET' | 'POST', complaintId?: string) {
  if (error instanceof MaterialServiceError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  captureException(error, {
    route: 'api/admin/complaints/[id]/materials',
    method,
    complaintId: complaintId ?? 'unknown',
  });
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  let complaintId: string | undefined;
  try {
    const auth = await requireStaff([...MATERIAL_TRACKING_ALLOWED_ROLES]);
    if (!auth.authorized) {
      return auth.response;
    }

    const rateLimit = await checkRateLimit(request, 'general', auth.user.id);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const idValidation = validateComplaintIdParam(params?.id);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: idValidation.error || 'Invalid complaint ID' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    complaintId = idValidation.data!;

    const data = await listComplaintMaterials(complaintId, {
      id: auth.user.id,
      role: auth.user.role,
      departmentId: auth.user.departmentId ?? null,
    });

    return NextResponse.json(
      { success: true, data },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return handleRouteError(error, 'GET', complaintId);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  let complaintId: string | undefined;
  try {
    const auth = await requireStaff([...MATERIAL_TRACKING_ALLOWED_ROLES]);
    if (!auth.authorized) {
      return auth.response;
    }

    const rateLimit = await checkRateLimit(request, 'general', auth.user.id);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const idValidation = validateComplaintIdParam(params?.id);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: idValidation.error || 'Invalid complaint ID' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    complaintId = idValidation.data!;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request body' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const result = await recordComplaintMaterialEntry(complaintId, body, {
      id: auth.user.id,
      role: auth.user.role,
      departmentId: auth.user.departmentId ?? null,
    });

    return NextResponse.json(
      { success: true, data: result },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return handleRouteError(error, 'POST', complaintId);
  }
}

