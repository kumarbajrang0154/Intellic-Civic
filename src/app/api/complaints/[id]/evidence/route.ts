import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { requireCitizen } from '@/lib/citizen-auth';
import { addEvidenceToComplaint } from '@/lib/complaints-store';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireCitizen();
    if (!auth.authorized) return auth.response;

    const { id } = params;
    const body = await request.json();
    const { imageUrl, stage } = body;
 
    if (!imageUrl) {
      return NextResponse.json(
        { statusCode: 400, message: 'imageUrl is required' },
        { status: 400 },
      );
    }

    const evidence = await addEvidenceToComplaint(id, { imageUrl, stage });
    if (!evidence) {
      return NextResponse.json(
        { statusCode: 404, message: 'Complaint not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, evidence });
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error', error: error.message },
      { status: 500 },
    );
  }
}
