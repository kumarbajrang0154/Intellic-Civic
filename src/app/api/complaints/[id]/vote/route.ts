import { NextRequest } from 'next/server';
import { handleVotePost, handleVoteDelete } from '@/lib/vote-route-handler';

export async function POST(
  request: NextRequest,
  context: { params: { id: string } },
) {
  return handleVotePost(request, context.params);
}

export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } },
) {
  return handleVoteDelete(request, context.params);
}
