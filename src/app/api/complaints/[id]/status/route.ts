import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { captureException } from '@/lib/error-monitoring';
import prisma from '@/lib/prisma';
import { ComplaintStatus } from '@prisma/client';

import { createNotification } from '@/lib/notifications-store';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import { validateComplaintIdParam } from '@/lib/validation';
import { buildAppUrl, sendTemplatedEmail } from '@/services/email-service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireStaff(['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'DEPARTMENT_OFFICER']);
    if (!auth.authorized) {
      return auth.response;
    }

    const rateLimit = await checkRateLimit(request, 'general', auth.user.id);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const idValidation = validateComplaintIdParam(params?.id);
    if (!idValidation.success) {
      return NextResponse.json({ statusCode: 400, message: idValidation.error }, { status: 400 });
    }
    const id = idValidation.data!;
    const body = await request.json().catch(() => ({}));
    const { status } = body;
    const notes = typeof body.notes === 'string' ? body.notes : typeof body.remarks === 'string' ? body.remarks : undefined;

    if (!status || !Object.values(ComplaintStatus).includes(status as ComplaintStatus)) {
      return NextResponse.json({ statusCode: 400, message: 'Invalid complaint status' }, { status: 400 });
    }

    const currentComplaint = await prisma.complaint.findUnique({
      where: { id },
      include: {
        citizen: {
          select: { id: true, email: true },
        },
      },
    });
    if (!currentComplaint) {
      return NextResponse.json({ statusCode: 404, message: 'Complaint not found' }, { status: 404 });
    }

    // Cross-department isolation check for Department Head & Officer
    if (['DEPARTMENT_HEAD', 'DEPARTMENT_OFFICER'].includes(auth.user.role)) {
      if (auth.user.departmentId && currentComplaint.departmentId && auth.user.departmentId !== currentComplaint.departmentId) {
        return NextResponse.json(
          { statusCode: 403, message: 'Forbidden: Cannot alter status of complaints outside your assigned department.' },
          { status: 403 },
        );
      }
    }

    const now = new Date();
    const updateData: any = {
      status: status as ComplaintStatus,
      statusHistory: {
        create: {
          fromStatus: currentComplaint.status,
          toStatus: status as ComplaintStatus,
          changedByUserId: auth.user.id,
          notes: notes || `Status changed to ${status} by ${auth.user.name} (${auth.user.role})`,
        },
      },
    };

    if (status === 'RESOLVED') {
      updateData.resolvedAt = now;
      if (notes) {
        updateData.resolutionNotes = notes;
      }
    } else if (status === 'CLOSED') {
      updateData.closedAt = now;
      if (!currentComplaint.resolvedAt) {
        updateData.resolvedAt = now;
      }
      if (notes) {
        updateData.resolutionNotes = notes;
      }
    }

    const updated = await prisma.complaint.update({
      where: { id },
      data: updateData,
    });

    // B4: Trigger real-time notification to citizen
    const notificationType = status === 'RESOLVED' ? 'RESOLVED' : status === 'CLOSED' ? 'CLOSED' : 'STATUS_CHANGED';
    const statusLabel = status === 'CLOSED' || status === 'RESOLVED' ? 'Resolved' : status.replace(/_/g, ' ');
    await createNotification({
      complaintId: id,
      recipientUserId: currentComplaint.citizenId,
      type: notificationType,
      message: `Your complaint #${currentComplaint.ticketId} status was updated to ${statusLabel}. ${notes ? `Notes: ${notes}` : ''}`.trim(),
    }).catch(() => {});

    // Post-commit email notification (non-blocking if missing API key or delivery fails)
    const citizenEmail = currentComplaint.citizen?.email;
    if (citizenEmail && status !== currentComplaint.status) {
      if (status === 'RESOLVED') {
        await sendTemplatedEmail('complaintResolved', citizenEmail, {
          ticketId: updated.ticketId,
          title: updated.title,
          resolutionNotes: notes || updated.resolutionNotes,
          feedbackUrl: buildAppUrl(`/citizen/complaints/${updated.id}#feedback`),
        }).catch(() => {});
      } else {
        await sendTemplatedEmail('complaintStatusChanged', citizenEmail, {
          ticketId: updated.ticketId,
          title: updated.title,
          previousStatus: currentComplaint.status,
          newStatus: status,
          notes: notes || null,
          complaintUrl: buildAppUrl(`/citizen/complaints/${updated.id}`),
        }).catch(() => {});
      }
    }

    return NextResponse.json({ success: true, complaint: updated });
  } catch (error: unknown) {
    captureException(error, { route: 'PATCH /api/complaints/[id]/status' });
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error' },
      { status: 500 },
    );
  }
}
