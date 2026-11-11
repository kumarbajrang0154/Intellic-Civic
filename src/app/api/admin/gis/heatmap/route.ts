import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { captureException } from '@/lib/error-monitoring';
import {
  computeHeatmapClusters,
  extractHeatPoints,
  gisHeatmapQuerySchema,
} from '@/lib/gis-heatmap';
import prisma from '@/lib/prisma';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaff(['SUPER_ADMIN', 'ADMIN']);
    if (!auth.authorized) return auth.response;

    const rateLimit = await checkRateLimit(request, 'general', auth.user.id);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const { searchParams } = new URL(request.url);
    const parsed = gisHeatmapQuerySchema.safeParse({
      departmentId: searchParams.get('departmentId') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      priority: searchParams.get('priority') ?? undefined,
      cellSizeDeg: searchParams.get('cellSizeDeg') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          statusCode: 400,
          message: parsed.error.issues[0]?.message || 'Invalid GIS heatmap query parameters.',
        },
        { status: 400 },
      );
    }

    const { departmentId, status, priority, cellSizeDeg } = parsed.data;

    const complaints = await prisma.complaint.findMany({
      where: {
        location: { isNot: null },
        ...(departmentId ? { departmentId } : {}),
        ...(status ? { status } : {}),
        ...(priority ? { priority } : {}),
      },
      take: 1000,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        ticketId: true,
        title: true,
        titleEn: true,
        language: true,
        status: true,
        priority: true,
        createdAt: true,
        category: { select: { name: true } },
        department: { select: { id: true, name: true } },
        location: {
          select: {
            latitude: true,
            longitude: true,
            address: true,
          },
        },
      },
    });

    const heatPoints = extractHeatPoints(complaints);
    const clusters = computeHeatmapClusters(heatPoints, cellSizeDeg);

    return NextResponse.json(
      {
        success: true,
        totalGeotagged: heatPoints.length,
        complaints: complaints.filter((c) => Boolean(c.location)),
        clusters,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: unknown) {
    captureException(error, { route: 'GET /api/admin/gis/heatmap' });
    return NextResponse.json(
      { statusCode: 500, message: 'Unable to load GIS heatmap coordinates.' },
      { status: 500 },
    );
  }
}

